import { runTrainingInHandler, type WorkerTrainConfig, type WorkerControl } from '../features/training/workerClient'
import { createTrainingControl } from '../features/training/trainingControl'
import { getTrainingCapability } from '../features/training/trainingCapabilities'
import type { TrainingEvent } from '../features/training/types'
interface WorkerScope { postMessage(message: unknown): void; onmessage: ((event: MessageEvent<{ type: string; runId?: string; config?: WorkerTrainConfig }>) => void) | null }
const scope = globalThis as unknown as WorkerScope
let control = createTrainingControl()
let cancelled = false
let activeRunId = ''
scope.onmessage = async ({ data }) => {
  if (data.type !== 'start') { control.send(data.type as WorkerControl | 'cancel'); if (data.type === 'cancel' || data.type === 'stop') cancelled = true; return }
  if (!data.config) return
  cancelled = false
  activeRunId = data.runId ?? createRunId()
  const capability = getTrainingCapability(data.config.kind, data.config as unknown as Record<string, unknown>)
  emit({ type: 'preparing', runId: activeRunId, capability })
  control = createTrainingControl(paused => emit({ type: paused ? 'paused' : 'resumed', runId: activeRunId, capability }), () => emit({ type: 'step-completed', runId: activeRunId, capability }))
  try {
    emit({ type: 'initializing', runId: activeRunId, capability })
    await Promise.resolve()
    emit({ type: 'started', runId: activeRunId, capability })
    const result = await runTrainingInHandler(data.config, snapshot => scope.postMessage({ type: 'snapshot', runId: activeRunId, snapshot, capability }), () => cancelled, control)
    if (!cancelled) { emit({ type: 'completed', runId: activeRunId, capability }); scope.postMessage({ type: 'complete', runId: activeRunId, result }) }
  } catch (error) {
    if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) { emit({ type: 'cancelled', runId: activeRunId, capability }); scope.postMessage({ type: 'cancelled', runId: activeRunId }) }
    else { const message = error instanceof Error ? error.message : '训练失败'; emit({ type: 'failed', runId: activeRunId, errorCode: 'TRAINING_ERROR', message }); scope.postMessage({ type: 'error', runId: activeRunId, errorCode: 'TRAINING_ERROR', error: message }) }
  }
}

function emit(event: TrainingEvent) { scope.postMessage({ type: 'event', event }) }
function createRunId(): string { return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(36).slice(2)}` }

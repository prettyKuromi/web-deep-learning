import { runTrainingInHandler, type WorkerTrainConfig, type WorkerControl } from '../features/training/workerClient'
import { createTrainingControl } from '../features/training/trainingControl'
interface WorkerScope { postMessage(message: unknown): void; onmessage: ((event: MessageEvent<{ type: string; config?: WorkerTrainConfig }>) => void) | null }
const scope = globalThis as unknown as WorkerScope
let control = createTrainingControl()
let cancelled = false
scope.onmessage = async ({ data }) => {
  if (data.type !== 'start') { control.send(data.type as WorkerControl | 'cancel'); if (data.type === 'cancel' || data.type === 'stop') cancelled = true; return }
  if (!data.config) return
  cancelled = false
  control = createTrainingControl(paused => scope.postMessage({ type: paused ? 'paused' : 'resumed' }))
  try {
    const result = await runTrainingInHandler(data.config, snapshot => scope.postMessage({ type: 'snapshot', snapshot }), () => cancelled, control)
    if (!cancelled) scope.postMessage({ type: 'complete', result })
  } catch (error) {
    scope.postMessage(cancelled || (error instanceof DOMException && error.name === 'AbortError') ? { type: 'cancel' } : { type: 'error', error: error instanceof Error ? error.message : '训练失败' })
  }
}

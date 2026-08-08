import { runTrainingInHandler, type WorkerTrainConfig } from '../features/training/workerClient'

interface WorkerScope {
  postMessage(message: unknown): void
  onmessage: ((event: MessageEvent<{ type: string; config?: WorkerTrainConfig }>) => void) | null
}

const scope = globalThis as unknown as WorkerScope
let cancelled = false

scope.onmessage = async ({ data }) => {
  if (data.type === 'cancel') {
    cancelled = true
    scope.postMessage({ type: 'cancel' })
    return
  }
  if (data.type !== 'start' || !data.config) return
  cancelled = false
  scope.postMessage({ type: 'start' })
  try {
    const result = await runTrainingInHandler(data.config, snapshot => scope.postMessage({ type: 'snapshot', snapshot }), () => cancelled)
    if (!cancelled) scope.postMessage({ type: 'complete', result })
  } catch (error) {
    if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
      scope.postMessage({ type: 'cancel' })
      return
    }
    scope.postMessage({ type: 'error', error: error instanceof Error ? error.message : '训练失败' })
  }
}


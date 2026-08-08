import { createKnnTrainer } from './knn'
import { createLogisticRegressionTrainer } from './logisticRegression'
import { createLinearSvmTrainer } from './linearSvm'
import type {
  KnnModel,
  KnnTrainConfig,
  LinearSvmModel,
  LinearSvmTrainConfig,
  LogisticRegressionModel,
  LogisticRegressionTrainConfig,
  TrainSnapshot,
} from './types'

export type WorkerTrainConfig =
  | ({ kind: 'knn' } & KnnTrainConfig)
  | ({ kind: 'logistic-regression' } & LogisticRegressionTrainConfig)
  | ({ kind: 'linear-svm' } & LinearSvmTrainConfig)

export type WorkerTrainResult =
  | { model: KnnModel; snapshots: TrainSnapshot[] }
  | { model: LogisticRegressionModel; snapshots: TrainSnapshot[] }
  | { model: LinearSvmModel; snapshots: TrainSnapshot[] }

export interface WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: unknown): void
  terminate(): void
}

type WorkerMessage =
  | { type: 'start' }
  | { type: 'snapshot'; snapshot: TrainSnapshot }
  | { type: 'complete'; result: WorkerTrainResult }
  | { type: 'error'; error: string }
  | { type: 'cancel' }

export function createTrainInWorkerClient(createWorker: () => WorkerLike = defaultWorker): {
  trainInWorker(config: WorkerTrainConfig, onSnapshot?: (snapshot: TrainSnapshot) => void, signal?: AbortSignal): Promise<WorkerTrainResult>
} {
  return {
    trainInWorker(config, onSnapshot, signal) {
      const worker = createWorker()
      return new Promise<WorkerTrainResult>((resolve, reject) => {
        let settled = false
        const cleanup = () => signal?.removeEventListener('abort', abort)
        const finish = (callback: () => void) => {
          if (settled) return
          settled = true
          cleanup()
          worker.terminate()
          callback()
        }
        const abort = () => {
          worker.postMessage({ type: 'cancel' })
          finish(() => reject(createAbortError()))
        }
        worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
          if (data.type === 'snapshot') onSnapshot?.(data.snapshot)
          else if (data.type === 'complete') finish(() => resolve(data.result))
          else if (data.type === 'error') finish(() => reject(new Error(data.error)))
          else if (data.type === 'cancel') finish(() => reject(createAbortError()))
        }
        worker.onerror = event => finish(() => reject(new Error(event.message || 'Worker 训练失败')))
        if (signal?.aborted) return abort()
        signal?.addEventListener('abort', abort, { once: true })
        worker.postMessage({ type: 'start', config })
      })
    },
  }
}

export const trainInWorker = createTrainInWorkerClient().trainInWorker

export async function runTrainingInHandler(config: WorkerTrainConfig, emit?: (snapshot: TrainSnapshot) => void, isCancelled: () => boolean = () => false): Promise<WorkerTrainResult> {
  if (isCancelled()) throw createAbortError()
  const snapshotEmit = (snapshot: TrainSnapshot) => {
    if (isCancelled()) throw createAbortError()
    emit?.(snapshot)
  }
  if (config.kind === 'knn') return createKnnTrainer().train(config, snapshotEmit)
  if (config.kind === 'logistic-regression') return createLogisticRegressionTrainer().train(config, snapshotEmit)
  return createLinearSvmTrainer().train(config, snapshotEmit)
}

function createAbortError(): DOMException {
  return new DOMException('训练已取消', 'AbortError')
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL('../../workers/training.worker.ts', import.meta.url), { type: 'module' })
}

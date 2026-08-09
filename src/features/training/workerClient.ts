import { createKnnTrainer } from './knn'
import { createLogisticRegressionTrainer } from './logisticRegression'
import { createLinearSvmTrainer } from './linearSvm'
import { createLinearRegressionTrainer, createRidgeRegressionTrainer } from './regression'
import { createKMeansTrainer } from './kmeans'
import { createPcaTrainer } from './pca'
import { createDecisionTreeTrainer } from './decisionTree'
import { createNaiveBayesTrainer } from './naiveBayes'
import { createAdaBoostTrainer, createPerceptronTrainer, createRandomForestTrainer } from './ensembles'
import { createDbscanTrainer } from './dbscan'
import type {
  KnnModel,
  KnnTrainConfig,
  LinearSvmModel,
  LinearSvmTrainConfig,
  LogisticRegressionModel,
  LogisticRegressionTrainConfig,
  RegressionModel, RegressionTrainConfig, KMeansModel, KMeansTrainConfig, PcaModel, PcaTrainConfig,
  DecisionTreeModel, DecisionTreeTrainConfig, NaiveBayesModel, NaiveBayesTrainConfig,
  AdaBoostModel, AdaBoostTrainConfig, DbscanModel, DbscanTrainConfig, PerceptronModel, PerceptronTrainConfig, RandomForestModel, RandomForestTrainConfig,
  TrainSnapshot,
} from './types'

export type WorkerTrainConfig =
  | ({ kind: 'knn' } & KnnTrainConfig)
  | ({ kind: 'logistic-regression' } & LogisticRegressionTrainConfig)
  | ({ kind: 'linear-svm' } & LinearSvmTrainConfig)
  | ({ kind: 'linear-regression' } & RegressionTrainConfig)
  | ({ kind: 'ridge-regression' } & RegressionTrainConfig)
  | ({ kind: 'k-means' } & KMeansTrainConfig)
  | ({ kind: 'pca' } & PcaTrainConfig)
  | ({ kind: 'decision-tree' } & DecisionTreeTrainConfig)
  | ({ kind: 'naive-bayes' } & NaiveBayesTrainConfig)
  | ({ kind: 'perceptron' } & PerceptronTrainConfig)
  | ({ kind: 'random-forest' } & RandomForestTrainConfig)
  | ({ kind: 'adaboost' } & AdaBoostTrainConfig)
  | ({ kind: 'dbscan' } & DbscanTrainConfig)

export type WorkerTrainResult =
  | { model: KnnModel; snapshots: TrainSnapshot[] }
  | { model: LogisticRegressionModel; snapshots: TrainSnapshot[] }
  | { model: LinearSvmModel; snapshots: TrainSnapshot[] }
  | { model: RegressionModel; snapshots: TrainSnapshot[] }
  | { model: KMeansModel; snapshots: TrainSnapshot[] }
  | { model: PcaModel; snapshots: TrainSnapshot[] }
  | { model: DecisionTreeModel; snapshots: TrainSnapshot[] }
  | { model: NaiveBayesModel; snapshots: TrainSnapshot[] }
  | { model: PerceptronModel; snapshots: TrainSnapshot[] }
  | { model: RandomForestModel; snapshots: TrainSnapshot[] }
  | { model: AdaBoostModel; snapshots: TrainSnapshot[] }
  | { model: DbscanModel; snapshots: TrainSnapshot[] }

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
  if (config.kind === 'linear-svm') return createLinearSvmTrainer().train(config, snapshotEmit)
  if (config.kind === 'linear-regression') return createLinearRegressionTrainer().train(config, snapshotEmit)
  if (config.kind === 'ridge-regression') return createRidgeRegressionTrainer().train(config, snapshotEmit)
  if (config.kind === 'k-means') return createKMeansTrainer().train(config, snapshotEmit)
  if (config.kind === 'pca') return createPcaTrainer().train(config, snapshotEmit)
  if (config.kind === 'decision-tree') return createDecisionTreeTrainer().train(config, snapshotEmit)
  if (config.kind === 'naive-bayes') return createNaiveBayesTrainer().train(config, snapshotEmit)
  if (config.kind === 'perceptron') return createPerceptronTrainer().train(config, snapshotEmit)
  if (config.kind === 'random-forest') return createRandomForestTrainer().train(config, snapshotEmit)
  if (config.kind === 'adaboost') return createAdaBoostTrainer().train(config, snapshotEmit)
  return createDbscanTrainer().train(config, snapshotEmit)
}

function createAbortError(): DOMException {
  return new DOMException('训练已取消', 'AbortError')
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL('../../workers/training.worker.ts', import.meta.url), { type: 'module' })
}

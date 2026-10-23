import { defaultParameters } from './modelParameters'
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
import { createMlpTrainer } from './mlp'
import { createVisualCnnTrainer } from './visualCnn'
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
  MlpModel, MlpTrainConfig, VisualCnnModel, VisualCnnTrainConfig,
  TrainSnapshot, TrainingControl,
  TrainingEvent, TrainingCapability,
} from './types'
import { getTrainingCapability } from './trainingCapabilities'

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
  | ({ kind: 'mlp' } & MlpTrainConfig)
  | ({ kind: 'visual-cnn' } & VisualCnnTrainConfig)

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
  | { model: MlpModel; snapshots: TrainSnapshot[] }
  | { model: VisualCnnModel; snapshots: TrainSnapshot[] }

export interface WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: unknown): void
  terminate(): void
}

type WorkerMessage =
  | { type: 'start'; runId?: string }
  | { type: 'snapshot'; runId?: string; snapshot: TrainSnapshot; capability?: TrainingCapability }
  | { type: 'complete'; runId?: string; result: WorkerTrainResult }
  | { type: 'error'; runId?: string; error: string; errorCode?: string }
  | { type: 'cancel' }
  | { type: 'stopped'; runId: string }
  | { type: 'cancelled'; runId: string }
  | { type: 'paused' | 'resumed' | 'step-completed'; runId: string }
  | { type: 'event'; event: TrainingEvent }

export type WorkerControl = 'pause' | 'resume' | 'step' | 'stop'

export function createTrainInWorkerClient(createWorker: () => WorkerLike = defaultWorker): {
  trainInWorker(config: WorkerTrainConfig, onSnapshot?: (snapshot: TrainSnapshot) => void, signal?: AbortSignal, onControl?: (paused: boolean) => void, onEvent?: (event: TrainingEvent) => void): Promise<WorkerTrainResult>
  sendControl(control: WorkerControl): void
} {
  let activeWorker: WorkerLike | undefined
  let stopActiveRun: (() => void) | undefined
  return {
    sendControl(control) {
      if (!activeWorker) return
      if (control === 'stop') stopActiveRun?.()
      else activeWorker.postMessage({ type: control })
    },
    trainInWorker(config, onSnapshot, signal, onControl, onEvent) {
      const worker = createWorker()
      activeWorker = worker
      const localRunId = createRunId()
      let currentRunId = localRunId
      const capability = getTrainingCapability(config.kind, config as unknown as Record<string, unknown>)
      return new Promise<WorkerTrainResult>((resolve, reject) => {
        let settled = false
        let terminalEventNotified = false
        const notifyTerminalEvent = (event: TrainingEvent) => {
          if (terminalEventNotified) return
          terminalEventNotified = true
          try { onEvent?.(event) }
          catch { /* 终态监听器不能改变训练结果或阻止 Worker 收尾。 */ }
        }
        const cleanup = () => signal?.removeEventListener('abort', abort)
        const finish = (callback: () => void) => {
          if (settled) return
          settled = true
          cleanup()
          if (activeWorker === worker) activeWorker = undefined
          if (stopActiveRun === stop) stopActiveRun = undefined
          worker.terminate()
          callback()
        }
        const stop = () => finish(() => {
          try { onEvent?.({ type: 'stopped', runId: currentRunId, capability }) }
          catch { /* 停止事件监听器不能阻止 Worker 和 Promise 收尾。 */ }
          reject(createAbortError())
        })
        const abort = () => {
          worker.postMessage({ type: 'cancel' })
          finish(() => reject(createAbortError()))
        }
        stopActiveRun = stop
        worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
          if (settled) return
          const messageRunId = data.type === 'event' ? data.event.runId : 'runId' in data ? data.runId : undefined
          if (messageRunId) currentRunId = messageRunId
          if (data.type === 'event') {
            if (data.event.type === 'completed' || data.event.type === 'failed') notifyTerminalEvent(data.event)
            else onEvent?.(data.event)
            if (data.event.type === 'paused' || data.event.type === 'resumed') onControl?.(data.event.type === 'paused')
            return
          }
          if (data.type === 'snapshot') {
            const event: TrainingEvent = { type: 'snapshot', runId: data.runId ?? localRunId, snapshot: data.snapshot, capability: data.capability ?? capability }
            onSnapshot?.(data.snapshot); onEvent?.(event)
          } else if (data.type === 'complete') {
            notifyTerminalEvent({ type: 'completed', runId: data.runId ?? localRunId, capability })
            finish(() => resolve(data.result))
          } else if (data.type === 'error') {
            notifyTerminalEvent({ type: 'failed', runId: data.runId ?? localRunId, errorCode: data.errorCode ?? 'TRAINING_ERROR', message: data.error })
            finish(() => reject(new Error(data.error)))
          } else if (data.type === 'paused' || data.type === 'resumed' || data.type === 'step-completed') { onControl?.(data.type === 'paused'); onEvent?.({ type: data.type, runId: data.runId, capability })
          } else if (data.type === 'stopped' || data.type === 'cancelled' || data.type === 'cancel') { onEvent?.({ type: data.type === 'stopped' ? 'stopped' : 'cancelled', runId: data.type === 'cancelled' || data.type === 'stopped' ? data.runId : localRunId, capability }); finish(() => reject(createAbortError()))
          }
        }
        worker.onerror = event => finish(() => reject(new Error(event.message || 'Worker 训练失败')))
        if (signal?.aborted) return abort()
        signal?.addEventListener('abort', abort, { once: true })
        // 保持旧 Worker 调用协议兼容；阶段事件由 Worker 自身确认后发送。
        worker.postMessage({ type: 'start', config })
      })
    },
  }
}

function createRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `run-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const trainInWorker = createTrainInWorkerClient().trainInWorker

export async function runTrainingInHandler(config: WorkerTrainConfig, emit?: (snapshot: TrainSnapshot) => void, isCancelled: () => boolean = () => false, control?: TrainingControl): Promise<WorkerTrainResult> {
  config = { ...defaultParameters(config.kind), ...config } as WorkerTrainConfig
  if (isCancelled()) throw createAbortError()
  const snapshotEmit = (snapshot: TrainSnapshot) => {
    if (isCancelled()) throw createAbortError()
    emit?.(snapshot)
  }
  if (config.kind === 'knn') return createKnnTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'logistic-regression') return createLogisticRegressionTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'linear-svm') return createLinearSvmTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'linear-regression') return createLinearRegressionTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'ridge-regression') return createRidgeRegressionTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'k-means') return createKMeansTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'pca') return createPcaTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'decision-tree') return createDecisionTreeTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'naive-bayes') return createNaiveBayesTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'perceptron') return createPerceptronTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'random-forest') return createRandomForestTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'adaboost') return createAdaBoostTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'mlp') return createMlpTrainer().train(config, snapshotEmit, control)
  if (config.kind === 'visual-cnn') return createVisualCnnTrainer().train(config, snapshotEmit, control)
  return createDbscanTrainer().train(config, snapshotEmit, control)
}

function createAbortError(): DOMException {
  return new DOMException('训练已取消', 'AbortError')
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL('../../workers/training.worker.ts', import.meta.url), { type: 'module' })
}

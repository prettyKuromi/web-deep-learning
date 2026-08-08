export type WorkbenchStage = '数据集' | '模型' | '训练' | '结果'

export const workbenchStages: WorkbenchStage[] = ['数据集', '模型', '训练', '结果']

import type { Dataset } from '../features/datasets/dataset'
import type { ClassificationMetrics, Labels, TrainSnapshot } from '../features/training/types'

export type ModelKind = 'knn' | 'logistic-regression' | 'linear-svm'

export interface ModelConfig {
  kind: ModelKind
  params: Record<string, number>
}

export interface TrainingState {
  status: string
  progress: number
  snapshots: TrainSnapshot[]
  metrics?: ClassificationMetrics
  error?: string
}

export interface ExperimentRecord {
  id: string
  createdAt: number | string
  dataset: Dataset
  modelKind: ModelKind
  config: Record<string, unknown>
  metrics?: ClassificationMetrics
  snapshots: TrainSnapshot[]
  model?: unknown
  predictions: Labels
}

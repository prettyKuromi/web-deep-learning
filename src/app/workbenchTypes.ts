export type WorkbenchStage = '数据集' | '模型' | '训练' | '结果'

export const workbenchStages: WorkbenchStage[] = ['数据集', '模型', '训练', '结果']

import type { Dataset } from '../features/datasets/dataset'
import type { ClassificationMetrics, Labels, TrainSnapshot } from '../features/training/types'

export type TaskKind = 'classification' | 'regression' | 'clustering' | 'dimensionality-reduction'
export type ModelKind =
  | 'knn' | 'logistic-regression' | 'linear-svm' | 'perceptron' | 'decision-tree' | 'random-forest' | 'adaboost' | 'naive-bayes' | 'mlp'
  | 'linear-regression' | 'ridge-regression' | 'k-means' | 'dbscan' | 'pca'

export const taskLabels: Record<TaskKind, string> = {
  classification: '分类',
  regression: '回归',
  clustering: '聚类',
  'dimensionality-reduction': '降维',
}

export const modelGroups: Record<TaskKind, readonly ModelKind[]> = {
  classification: ['knn', 'logistic-regression', 'linear-svm', 'perceptron', 'decision-tree', 'random-forest', 'adaboost', 'naive-bayes', 'mlp'],
  regression: ['linear-regression', 'ridge-regression'],
  clustering: ['k-means', 'dbscan'],
  'dimensionality-reduction': ['pca'],
}

export const modelTask: Record<ModelKind, TaskKind> = Object.fromEntries(
  (Object.entries(modelGroups) as [TaskKind, readonly ModelKind[]][]).flatMap(([task, models]) => models.map((model) => [model, task])),
) as Record<ModelKind, TaskKind>

export interface ModelConfig {
  kind?: ModelKind
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

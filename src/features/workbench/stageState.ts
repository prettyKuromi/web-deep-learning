import { validateDataset, type Dataset } from '../datasets/dataset'
import type { ClassificationMetrics } from '../training/types'
import type { ModelConfig, TrainingState } from '../../app/workbenchTypes'

export type StageStatus = 'pending' | 'active' | 'completed' | 'blocked'

export interface StageProgress {
  dataset: StageStatus
  model: StageStatus
  training: StageStatus
  results: StageStatus
}

export interface StageStateInput {
  dataset: Dataset | null | undefined
  modelConfig: ModelConfig | null | undefined
  training: TrainingState | null | undefined
}

function isModelConfigValid(config: ModelConfig | null | undefined): config is ModelConfig {
  if (!config || !config.kind || !['knn', 'logistic-regression', 'linear-svm', 'perceptron', 'decision-tree', 'random-forest', 'adaboost', 'naive-bayes', 'linear-regression', 'ridge-regression', 'k-means', 'dbscan', 'pca'].includes(config.kind)) return false
  const params = config.params
  if (!params || typeof params !== 'object') return false
  return Object.values(params).every((value) => typeof value === 'number' && Number.isFinite(value)) && (
    config.kind !== 'knn' || Number.isInteger(params.k) && params.k > 0
  )
}

function hasTrainingResult(training: TrainingState | null | undefined): training is TrainingState & { metrics: ClassificationMetrics } {
  return Boolean(training?.metrics)
}

export function getStageProgress({ dataset, modelConfig, training }: StageStateInput): StageProgress {
  const datasetReady = Boolean(dataset && validateDataset(dataset).valid)
  if (!datasetReady) {
    return { dataset: 'active', model: 'blocked', training: 'blocked', results: 'blocked' }
  }

  const modelReady = isModelConfigValid(modelConfig)
  if (!modelReady) {
    return { dataset: 'completed', model: 'active', training: 'blocked', results: 'blocked' }
  }

  if (!hasTrainingResult(training)) {
    return { dataset: 'completed', model: 'completed', training: 'active', results: 'blocked' }
  }

  return { dataset: 'completed', model: 'completed', training: 'completed', results: 'completed' }
}

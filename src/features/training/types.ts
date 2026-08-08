export type FeatureVector = readonly number[]
export type FeatureMatrix = readonly FeatureVector[]
export type Label = string | number
export type Labels = readonly Label[]

export interface TrainSnapshot {
  iteration: number
  loss?: number
  metrics?: ClassificationMetrics
}

export interface ClassificationMetrics {
  accuracy: number
  precision: number
  recall: number
  f1: number
  labels: Label[]
  confusionMatrix: number[][]
}

export interface KnnTrainConfig {
  samples: FeatureMatrix
  labels: Labels
  k: number
}

export interface KnnModel {
  kind: 'knn'
  samples: number[][]
  labels: Label[]
  k: number
}

export interface Trainer<C = unknown, M = unknown, P = Labels> {
  train(config: C, emit?: (snapshot: TrainSnapshot) => void): Promise<{ model: M; snapshots: TrainSnapshot[] }>
  predict(model: M, samples: FeatureMatrix): P
}

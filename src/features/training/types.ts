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

export interface LogisticRegressionTrainConfig {
  samples: FeatureMatrix
  labels: Labels
  learningRate?: number
  iterations?: number
  regularization?: number
}

export interface LogisticRegressionModel {
  kind: 'logistic-regression'
  labels: Label[]
  weights: number[][]
  dimensions: number
}

export interface LinearSvmTrainConfig {
  samples: FeatureMatrix
  labels: Labels
  learningRate?: number
  iterations?: number
  regularization?: number
  margin?: number
}

export interface LinearSvmModel {
  kind: 'linear-svm'
  labels: Label[]
  weights: number[][]
  dimensions: number
}

export interface Trainer<C = unknown, M = unknown, P = Labels> {
  train(config: C, emit?: (snapshot: TrainSnapshot) => void): Promise<{ model: M; snapshots: TrainSnapshot[] }>
  predict(model: M, samples: FeatureMatrix): P
}

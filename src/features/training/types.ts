export type FeatureVector = readonly number[]
export type FeatureMatrix = readonly FeatureVector[]
export type Label = string | number
export type Labels = readonly Label[]
export type TaskKind = 'classification' | 'regression' | 'clustering' | 'dimensionality-reduction'
export type ModelKind = 'knn' | 'logistic-regression' | 'linear-svm' | 'perceptron' | 'decision-tree' | 'random-forest' | 'adaboost' | 'naive-bayes' | 'linear-regression' | 'ridge-regression' | 'k-means' | 'dbscan' | 'pca' | 'mlp'

export interface TrainSnapshot {
  iteration: number
  /** 通用时间线步号；缺省时与 iteration 相同。 */
  step?: number
  epoch?: number
  loss?: number
  metrics?: ClassificationMetrics
  chart?: {
    points?: number[][]
    labels?: Label[]
    boundary?: number[][]
  }
  explanation?: Record<string, unknown>
  timestamp?: number
  network?: Array<{ name: string; shape: string; parameters: number; activation: number }>
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

export interface RegressionTrainConfig { samples: FeatureMatrix; labels: readonly number[]; learningRate?: number; iterations?: number; regularization?: number }
export interface RegressionModel { kind: 'linear-regression' | 'ridge-regression'; weights: number[]; dimensions: number }
export interface KMeansTrainConfig { samples: FeatureMatrix; k: number; iterations?: number; seed?: number }
export interface KMeansModel { kind: 'k-means'; centroids: number[][]; dimensions: number }
export interface PcaTrainConfig { samples: FeatureMatrix; components?: number }
export interface PcaModel { kind: 'pca'; means: number[]; components: number[][]; explainedVariance: number[]; dimensions: number }
export interface DecisionTreeTrainConfig { samples: FeatureMatrix; labels: Labels; maxDepth?: number; minSamplesSplit?: number }
export type DecisionTreeNode = { prediction: Label; feature?: number; threshold?: number; left?: DecisionTreeNode; right?: DecisionTreeNode }
export interface DecisionTreeModel { kind: 'decision-tree'; root: DecisionTreeNode; dimensions: number }
export interface NaiveBayesTrainConfig { samples: FeatureMatrix; labels: Labels; varianceSmoothing?: number }
export interface NaiveBayesModel { kind: 'naive-bayes'; labels: Label[]; means: number[][]; variances: number[][]; priors: number[]; dimensions: number }
export interface PerceptronTrainConfig { samples: FeatureMatrix; labels: Labels; learningRate?: number; iterations?: number }
export interface PerceptronModel { kind: 'perceptron'; labels: Label[]; weights: number[][]; dimensions: number }
export interface RandomForestTrainConfig { samples: FeatureMatrix; labels: Labels; trees?: number; maxDepth?: number }
export interface RandomForestModel { kind: 'random-forest'; trees: DecisionTreeModel[]; labels: Label[]; dimensions: number }
export interface AdaBoostTrainConfig { samples: FeatureMatrix; labels: Labels; rounds?: number }
export interface AdaBoostModel { kind: 'adaboost'; stumps: Array<{ feature: number; threshold: number; polarity: number; alpha: number }>; labels: Label[]; dimensions: number }
export interface DbscanTrainConfig { samples: FeatureMatrix; epsilon?: number; minPoints?: number }
export interface DbscanModel { kind: 'dbscan'; samples: number[][]; assignments: number[]; epsilon: number; dimensions: number }

export interface MlpTrainConfig {
  samples: FeatureMatrix
  labels: Labels
  hiddenLayers?: number[]
  activation?: 'relu' | 'tanh' | 'sigmoid'
  learningRate?: number
  epochs?: number
  batchSize?: number
  validationSplit?: number
  normalize?: boolean
  seed?: number
}

export interface MlpModel {
  kind: 'mlp'
  labels: Label[]
  layers: number[]
  activation: 'relu' | 'tanh' | 'sigmoid'
  weights: number[][][]
  biases: number[][]
  means?: number[]
  scales?: number[]
  seed: number
}

export interface VisualCnnTrainConfig {
  samples: FeatureMatrix
  labels: Labels
  imageShape: { width: number; height: number; channels: number }
  layers: import('./visualNetwork').VisualLayer[]
  learningRate?: number
  epochs?: number
  batchSize?: number
  seed?: number
}

export interface VisualCnnModel {
  kind: 'visual-cnn'
  labels: Label[]
  imageShape: { width: number; height: number; channels: number }
  layers: import('./visualNetwork').VisualLayer[]
  parameters: Record<string, { weights: number[]; biases: number[]; inputSize: number; outputSize: number }>
  seed: number
}

export interface TrainingControl { checkpoint(): Promise<void>; yield?(): Promise<void> }

export interface Trainer<C = unknown, M = unknown, P = Labels> {
  train(config: C, emit?: (snapshot: TrainSnapshot) => void, control?: TrainingControl): Promise<{ model: M; snapshots: TrainSnapshot[] }>
  predict(model: M, samples: FeatureMatrix): P
}

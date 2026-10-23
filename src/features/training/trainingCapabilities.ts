import type { ModelKind } from '../../app/workbenchTypes'
import type { TrainingCapability, TrainingUnit } from './types'

const CONTROLLED_MODELS = new Set<ModelKind>([
  'logistic-regression', 'linear-svm', 'mlp', 'visual-cnn', 'lstm', 'transformer', 'linear-regression', 'ridge-regression',
])

const MODEL_UNITS: Record<ModelKind, TrainingUnit> = {
  knn: 'fit', 'logistic-regression': 'iteration', 'linear-svm': 'iteration', perceptron: 'iteration',
  'decision-tree': 'fit', 'random-forest': 'tree', adaboost: 'round', 'naive-bayes': 'fit',
  'linear-regression': 'iteration', 'ridge-regression': 'iteration', 'k-means': 'iteration', dbscan: 'fit',
  pca: 'fit', mlp: 'epoch', 'visual-cnn': 'epoch', lstm: 'epoch', transformer: 'epoch',
}

/** 根据真实配置集中生成 Worker 能力，UI 不应再按模型名称猜测。 */
export function getTrainingCapability(kind: ModelKind, params: Record<string, unknown> = {}): TrainingCapability {
  const unit = MODEL_UNITS[kind]
  const rawTotal = unit === 'iteration' ? params.iterations : unit === 'epoch' ? params.epochs : unit === 'tree' ? params.trees : unit === 'round' ? params.rounds : undefined
  const total = typeof rawTotal === 'number' && Number.isFinite(rawTotal) && rawTotal > 0 ? Math.floor(rawTotal) : undefined
  const controllable = CONTROLLED_MODELS.has(kind)
  return { unit, total, canPause: controllable, canStep: controllable, canStop: true }
}

export function trainingUnitLabel(unit: TrainingUnit): string {
  return unit === 'iteration' ? '迭代' : unit === 'epoch' ? '轮次' : unit === 'tree' ? '树' : unit === 'round' ? '轮' : '拟合'
}

import type { FeatureMatrix, Labels, ClassificationMetrics, Label } from './types'

export interface EvaluationConfig {
  enabled: boolean
  validationSplit: number
  seed: number
}

export interface DatasetSplit {
  trainIndices: number[]
  validationIndices: number[]
  validationSplit: number
  seed: number
}

export interface RegressionMetrics {
  mae: number
  mse: number
  r2: number
}

export interface EvaluationMetrics {
  train: { sampleCount: number; metrics: ClassificationMetrics | RegressionMetrics }
  validation?: { sampleCount: number; metrics: ClassificationMetrics | RegressionMetrics }
  evaluatedAtStep: number
}

/**
 * Deterministically splits a dataset. Classification uses a per-label split so
 * every class remains represented in the training set whenever possible.
 */
export function splitDataset(labels: Labels, config: Pick<EvaluationConfig, 'validationSplit' | 'seed'>, task: 'classification' | 'regression'): DatasetSplit {
  if (!Number.isInteger(config.seed)) throw new Error('随机种子必须是整数')
  if (!Number.isFinite(config.validationSplit) || config.validationSplit < 0 || config.validationSplit >= 1) {
    throw new Error('验证集比例必须在 0 到 1 之间')
  }
  const size = labels.length
  if (size < 2) throw new Error('样本至少需要 2 条才能划分验证集')
  if (config.validationSplit === 0) return { trainIndices: labels.map((_, index) => index), validationIndices: [], validationSplit: 0, seed: config.seed }
  const random = seededRandom(config.seed)
  const groups = task === 'classification' ? groupIndices(labels) : new Map([['all', labels.map((_, index) => index)]])
  const validationIndices: number[] = []
  groups.forEach(indices => {
    const shuffled = shuffle(indices, random)
    const requested = Math.floor(shuffled.length * config.validationSplit)
    const count = task === 'classification'
      ? Math.min(Math.max(requested, shuffled.length > 1 ? 1 : 0), Math.max(0, shuffled.length - 1))
      : Math.min(Math.max(requested, 1), shuffled.length - 1)
    validationIndices.push(...shuffled.slice(0, count))
  })
  if (validationIndices.length === 0) throw new Error('当前样本量不足以划分验证集，请降低验证集比例或关闭验证集')
  const validationSet = new Set(validationIndices)
  const trainIndices = labels.map((_, index) => index).filter(index => !validationSet.has(index))
  return { trainIndices, validationIndices: validationIndices.sort((a, b) => a - b), validationSplit: validationIndices.length / size, seed: config.seed }
}

export function classificationEvaluation(actual: Labels, predicted: Labels, step = 0): EvaluationMetrics {
  return { train: { sampleCount: actual.length, metrics: classificationMetrics(actual, predicted) }, evaluatedAtStep: step }
}

export function regressionMetrics(actual: readonly number[], predicted: readonly number[]): RegressionMetrics {
  if (actual.length !== predicted.length) throw new Error('真实值和预测值数量必须一致')
  if (actual.length === 0) return { mae: 0, mse: 0, r2: 0 }
  const errors = actual.map((value, index) => value - predicted[index])
  const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / actual.length
  const mse = errors.reduce((sum, value) => sum + value ** 2, 0) / actual.length
  const mean = actual.reduce((sum, value) => sum + value, 0) / actual.length
  const total = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0)
  return { mae, mse, r2: total === 0 ? (mse === 0 ? 1 : 0) : 1 - (mse * actual.length) / total }
}

function classificationMetrics(actual: Labels, predicted: Labels): ClassificationMetrics {
  if (actual.length !== predicted.length) throw new Error('真实值和预测值数量必须一致')
  const labels = [...new Set([...actual, ...predicted])]
  const confusionMatrix = labels.map(() => labels.map(() => 0))
  const index = new Map<Label, number>(labels.map((label, i) => [label, i]))
  actual.forEach((value, i) => confusionMatrix[index.get(value)!][index.get(predicted[i])!] += 1)
  const scores = labels.map((_, i) => {
    const tp = confusionMatrix[i][i]
    const fp = confusionMatrix.reduce((sum, row) => sum + row[i], 0) - tp
    const fn = confusionMatrix[i].reduce((sum, value) => sum + value, 0) - tp
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
    return { precision, recall, f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall) }
  })
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  return { accuracy: actual.length ? actual.filter((value, i) => value === predicted[i]).length / actual.length : 0, precision: average(scores.map(s => s.precision)), recall: average(scores.map(s => s.recall)), f1: average(scores.map(s => s.f1)), labels, confusionMatrix }
}

function groupIndices(labels: Labels): Map<Label, number[]> {
  const groups = new Map<Label, number[]>()
  labels.forEach((label, index) => groups.set(label, [...(groups.get(label) ?? []), index]))
  return groups
}
function shuffle(values: number[], random: () => number): number[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index--) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]] }
  return result
}
function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 }
}

export function selectRows(samples: FeatureMatrix, indices: readonly number[]): FeatureMatrix { return indices.map(index => samples[index]) }
export function selectLabels(labels: Labels, indices: readonly number[]): Labels { return indices.map(index => labels[index]) }

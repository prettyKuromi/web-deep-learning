import type { ClassificationMetrics, Label, Labels } from './types'

export function classificationMetrics(actual: Labels, predicted: Labels): ClassificationMetrics {
  if (actual.length !== predicted.length) throw new Error('actual and predicted labels must have the same length')
  const labels = [...new Set([...actual, ...predicted])]
  const confusionMatrix = labels.map(() => labels.map(() => 0))
  const index = new Map<Label, number>(labels.map((label, i) => [label, i]))
  actual.forEach((value, i) => {
    confusionMatrix[index.get(value)!][index.get(predicted[i])!] += 1
  })
  const scores = labels.map((_, i) => {
    const tp = confusionMatrix[i][i]
    const fp = confusionMatrix.reduce((sum, row) => sum + row[i], 0) - tp
    const fn = confusionMatrix[i].reduce((sum, value) => sum + value, 0) - tp
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
    return { precision, recall, f1 }
  })
  const total = actual.length
  return {
    accuracy: total === 0 ? 0 : actual.filter((value, i) => value === predicted[i]).length / total,
    precision: average(scores.map(score => score.precision)),
    recall: average(scores.map(score => score.recall)),
    f1: average(scores.map(score => score.f1)),
    labels,
    confusionMatrix,
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

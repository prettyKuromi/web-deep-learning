import { modelTask, type ExperimentRecord } from '../../app/workbenchTypes'
import type { PcaModel } from '../training/types'
export function regressionMetrics(actual: readonly number[], predicted: readonly number[]) {
  const mean = actual.reduce((sum, value) => sum + value, 0) / actual.length
  const residual = actual.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0)
  const variance = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0)
  return { mae: actual.reduce((sum, value, index) => sum + Math.abs(value - predicted[index]), 0) / actual.length, mse: residual / actual.length, r2: variance === 0 ? (residual === 0 ? 1 : 0) : 1 - residual / variance }
}
export function experimentSummary(record: ExperimentRecord): string {
  if (record.runMetadata?.status === 'stopped') return `训练已停止 · 已记录 ${record.snapshots.length} 个快照`
  const task = modelTask[record.modelKind]
  if (task === 'classification') return record.metrics?.accuracy == null ? '分类指标未记录' : '训练集准确率 ' + (record.metrics.accuracy * 100).toFixed(1) + '%'
  if (task === 'regression') return record.predictions.length !== record.dataset.labels.length ? '回归指标未记录' : '训练集 MAE ' + regressionMetrics(record.dataset.labels as number[], record.predictions as number[]).mae.toFixed(4)
  if (task === 'clustering') return '簇数 ' + new Set((record.predictions as number[]).filter(value => value >= 0)).size + ' · 噪声 ' + (record.predictions as number[]).filter(value => value < 0).length
  const model = record.model as PcaModel
  return model?.explainedVariance ? '累计方差解释率 ' + (model.explainedVariance.reduce((sum, value) => sum + value, 0) * 100).toFixed(1) + '%' : '降维指标未记录'
}

import { modelTask, type ExperimentRecord } from '../../app/workbenchTypes'
import { regressionMetrics } from '../workbench/resultUtils'

export interface ExperimentMetricGroup {
  source: string
  sampleCount?: number
  metrics: Array<{ label: string; value: number }>
}

const classificationLabels: Record<string, string> = { accuracy: '准确率', precision: '精确率', recall: '召回率', f1: 'F1' }
const regressionLabels: Record<string, string> = { mae: 'MAE', mse: 'MSE', r2: 'R²' }

function values(metrics: unknown, labels: Record<string, string>) {
  if (!metrics || typeof metrics !== 'object') return []
  return Object.entries(labels).flatMap(([key, label]) => {
    const value = (metrics as Record<string, unknown>)[key]
    return typeof value === 'number' && Number.isFinite(value) ? [{ label, value }] : []
  })
}

export function experimentMetricGroups(record: ExperimentRecord): ExperimentMetricGroup[] {
  if (record.runMetadata?.status === 'stopped') return []
  const task = modelTask[record.modelKind]
  if (task === 'classification' || task === 'regression') {
    const labels = task === 'classification' ? classificationLabels : regressionLabels
    const trainMetrics = record.evaluation?.trainMetrics ?? (task === 'classification' ? record.metrics : undefined)
    const groups: ExperimentMetricGroup[] = [{
      source: '训练集',
      sampleCount: record.evaluation?.trainSampleCount ?? record.dataset.features.length,
      metrics: values(trainMetrics, labels),
    }]
    if (task === 'regression' && !trainMetrics && record.predictions.length === record.dataset.labels.length) {
      groups[0].metrics = values(regressionMetrics(record.dataset.labels as number[], record.predictions as number[]), labels)
    }
    if (record.evaluation?.validationSampleCount) groups.push({
      source: '验证集', sampleCount: record.evaluation.validationSampleCount,
      metrics: values(record.evaluation.validationMetrics, labels),
    })
    return groups
  }
  if (task === 'clustering') {
    const predictions = record.predictions as readonly number[]
    return [{ source: '全量数据', sampleCount: predictions.length, metrics: [
      { label: '簇数', value: new Set(predictions.filter(value => value >= 0)).size },
      { label: '噪声样本数', value: predictions.filter(value => value < 0).length },
    ] }]
  }
  const ratios = (record.model as { explainedVariance?: number[] } | undefined)?.explainedVariance ?? []
  let cumulative = 0
  const metrics = ratios.flatMap((ratio, index) => {
    if (!Number.isFinite(ratio)) return []
    cumulative += ratio
    return [{ label: `主成分 ${index + 1} 方差解释率`, value: ratio }]
  })
  if (metrics.length) metrics.push({ label: '累计方差解释率', value: cumulative })
  return [{ source: '全量数据', sampleCount: record.dataset.features.length, metrics }]
}

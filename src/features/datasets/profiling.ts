import type { Dataset } from './dataset'

export interface FeatureProfile {
  index: number
  name: string
  min: number | null
  max: number | null
  mean: number | null
  standardDeviation: number | null
  nonFiniteCount: number
}

export interface DatasetProfile {
  sampleCount: number
  featureCount: number
  classCount: number
  classDistribution: Array<{ label: string | number; count: number; ratio: number }>
  features: FeatureProfile[]
  warnings: string[]
}

const formatFeatureName = (dataset: Dataset, index: number) => dataset.featureNames?.[index] ?? `特征 ${index + 1}`

export function profileDataset(dataset: Dataset): DatasetProfile {
  const sampleCount = dataset.features.length
  const featureCount = dataset.features.reduce((max, row) => Math.max(max, row.length), 0)
  const labels = new Map<string | number, number>()
  dataset.labels.forEach((label) => labels.set(label, (labels.get(label) ?? 0) + 1))
  const features = Array.from({ length: featureCount }, (_, index) => {
    const values = dataset.features.map((row) => row[index])
    const finite = values.filter((value): value is number => Number.isFinite(value))
    const mean = finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
    const variance = mean == null ? null : finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length
    return {
      index,
      name: formatFeatureName(dataset, index),
      min: finite.length ? Math.min(...finite) : null,
      max: finite.length ? Math.max(...finite) : null,
      mean,
      standardDeviation: variance == null ? null : Math.sqrt(variance),
      nonFiniteCount: values.length - finite.length,
    }
  })
  const classDistribution = [...labels.entries()].map(([label, count]) => ({ label, count, ratio: sampleCount ? count / sampleCount : 0 }))
  const warnings: string[] = []
  if (sampleCount < 30) warnings.push('样本量较少，训练和评估结果可能不稳定；可增加样本后再比较模型。')
  if (classDistribution.length > 1 && Math.max(...classDistribution.map((item) => item.ratio)) >= 0.8) warnings.push('类别分布可能不平衡，建议同时关注少数类的召回率和 F1。')
  if (features.some((feature) => feature.nonFiniteCount > 0)) warnings.push('部分特征包含非有限值，训练前请检查 CSV 数据。')
  const scales = features.map((feature) => (feature.max == null || feature.min == null ? 0 : feature.max - feature.min)).filter((scale) => scale > 0)
  if (scales.length > 1 && Math.max(...scales) / Math.min(...scales) >= 100) warnings.push('特征尺度差异较大，建议使用标准化或归一化后再比较模型。')
  return { sampleCount, featureCount, classCount: classDistribution.length, classDistribution, features, warnings }
}

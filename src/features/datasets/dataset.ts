import Papa from 'papaparse'

export type FeatureVector = [number, number]

export interface DatasetMetadata {
  description: string
  characteristics: string
}

export const BUILTIN_DATASET_METADATA: Record<BuiltinDatasetId, DatasetMetadata> = {
  linear: { description: '默认约 200 条二维二分类样本。', characteristics: '线性边界，类别大致线性可分，适合逻辑回归和线性 SVM。' },
  xor: { description: '默认约 200 条二维二分类样本。', characteristics: '四象限 XOR 结构，线性不可分，适合观察非线性模型的局限。' },
  moons: { description: '默认约 200 条二维二分类样本。', characteristics: '两条带噪月牙，非线性可分，边界呈弯曲形状。' },
  circles: { description: '默认约 200 条二维二分类样本。', characteristics: '同心圆结构，非线性可分，适合观察环形决策边界。' },
  blobs: { description: '默认约 200 条二维二分类样本。', characteristics: '两个带高斯噪声的随机簇，类别通常近似线性可分。' },
}

export interface Dataset {
  features: FeatureVector[]
  labels: Array<string | number>
  name?: string
}

export interface DatasetPreview {
  sampleCount: number
  featureCount: number
  labelCount: number
  missingCount: number
  featureRanges: Array<{ min: number | null; max: number | null }>
  labelDistribution: Array<{ label: string | number; count: number }>
  sampleRows: Array<{ index: number; features: FeatureVector; label: string | number | undefined }>
}

export function createDatasetPreview(dataset: Dataset, maxRows = 8): DatasetPreview {
  const featureCount = dataset.features.reduce((max, row) => Math.max(max, row.length), 0)
  const missingCount = dataset.features.reduce((total, row, index) => total + row.filter((value) => !Number.isFinite(value)).length + (dataset.labels[index] == null || dataset.labels[index] === '' ? 1 : 0), 0)
  const featureRanges = Array.from({ length: featureCount }, (_, column) => {
    const values = dataset.features.map((row) => row[column]).filter((value): value is number => Number.isFinite(value))
    return { min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null }
  })
  const counts = new Map<string | number, number>()
  dataset.labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1))
  return {
    sampleCount: dataset.features.length,
    featureCount,
    labelCount: counts.size,
    missingCount,
    featureRanges,
    labelDistribution: [...counts.entries()].map(([label, count]) => ({ label, count })),
    sampleRows: dataset.features.slice(0, maxRows).map((features, index) => ({ index, features, label: dataset.labels[index] })),
  }
}

export type BuiltinDatasetId = 'linear' | 'xor' | 'moons' | 'circles' | 'blobs'

export const BUILTIN_DATASETS: Array<{ id: BuiltinDatasetId; name: string }> = [
  { id: 'linear', name: '线性可分' },
  { id: 'xor', name: 'XOR' },
  { id: 'moons', name: '月牙形' },
  { id: 'circles', name: '环形' },
  { id: 'blobs', name: '随机簇' },
]

export interface BuiltinDatasetOptions {
  samples?: number
  noise?: number
  seed?: number
}

function rng(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(random: () => number) {
  const u = Math.max(random(), Number.EPSILON)
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function generateBuiltinDataset(id: BuiltinDatasetId, options: BuiltinDatasetOptions = {}): Dataset {
  const samples = Math.max(2, Math.floor(options.samples ?? 200))
  const noise = options.noise ?? 0.1
  const random = rng(options.seed ?? 42)
  const features: FeatureVector[] = []
  const labels: number[] = []
  for (let i = 0; i < samples; i += 1) {
    const t = i / samples
    let x = 0
    let y = 0
    let label = 0
    if (id === 'linear') {
      x = random() * 2 - 1
      y = random() * 2 - 1
      label = y > x ? 1 : 0
    } else if (id === 'xor') {
      x = random() * 2 - 1
      y = random() * 2 - 1
      label = x * y >= 0 ? 1 : 0
    } else if (id === 'moons') {
      const angle = (i % Math.ceil(samples / 2)) / Math.ceil(samples / 2) * Math.PI
      if (i < samples / 2) {
        x = Math.cos(angle)
        y = Math.sin(angle)
      } else {
        x = 1 - Math.cos(angle)
        y = 0.5 - Math.sin(angle)
        label = 1
      }
    } else if (id === 'circles') {
      const angle = t * Math.PI * 2
      const radius = i % 2 === 0 ? 0.45 : 0.9
      x = radius * Math.cos(angle)
      y = radius * Math.sin(angle)
      label = i % 2
    } else {
      label = i % 2
      x = label ? 1 : -1
      y = label ? 1 : -1
      if (i % 4 >= 2) y *= -1
      x += gaussian(random) * 0.35
      y += gaussian(random) * 0.35
    }
    x += gaussian(random) * noise
    y += gaussian(random) * noise
    features.push([x, y])
    labels.push(label)
  }
  return { features, labels, name: BUILTIN_DATASETS.find((item) => item.id === id)?.name }
}

export interface CsvParseOptions {
  featureColumns?: [string, string]
  labelColumn?: string
}

export interface CsvParseResult {
  dataset: Dataset
  skippedRows: number
  columns: string[]
}

export function parseCsvDataset(csv: string, options: CsvParseOptions = {}): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: true })
  if (parsed.errors.length > 0 && parsed.data.length === 0) throw new Error(`CSV 解析失败：${parsed.errors[0]?.message ?? '格式错误'}`)
  const columns = parsed.meta.fields ?? []
  const featureColumns = options.featureColumns ?? [columns[0] ?? '', columns[1] ?? '']
  const labelColumn = options.labelColumn ?? columns[columns.length - 1] ?? ''
  const features: FeatureVector[] = []
  const labels: string[] = []
  let skippedRows = 0
  for (const row of parsed.data) {
    const rawX = row[featureColumns[0]]?.trim()
    const rawY = row[featureColumns[1]]?.trim()
    const x = Number(rawX)
    const y = Number(rawY)
    const label = row[labelColumn]?.trim()
    if (!rawX || !rawY || !Number.isFinite(x) || !Number.isFinite(y) || !label) {
      skippedRows += 1
      continue
    }
    features.push([x, y])
    labels.push(label)
  }
  if (features.length === 0) throw new Error('CSV 至少需要一行有效数据（两个数值特征和非空标签）')
  const dataset = { features, labels, name: 'CSV 数据集' }
  const validation = validateDataset(dataset)
  if (!validation.valid) throw new Error(validation.errors.join('；'))
  return { dataset, skippedRows, columns }
}

export function validateDataset(dataset: Dataset): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (dataset.features.length === 0) errors.push('数据集不能为空')
  if (dataset.features.length !== dataset.labels.length) errors.push('特征与标签数量必须一致')
  if (dataset.features.some((vector) => vector.length !== 2 || vector.some((value) => !Number.isFinite(value)))) {
    errors.push('每行必须包含两个有限数值特征')
  }
  if (dataset.labels.some((label) => label === '' || label === null || label === undefined)) errors.push('标签不能为空')
  if (new Set(dataset.labels).size < 2) errors.push('至少需要两个不同的类别标签')
  return { valid: errors.length === 0, errors }
}

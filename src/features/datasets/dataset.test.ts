import { describe, expect, it } from 'vitest'
import { BUILTIN_DATASET_METADATA, BUILTIN_DATASETS, createDatasetPreview, generateBuiltinDataset, parseCsvDataset, validateDataset } from './dataset'

describe('内置数据集', () => {
  it('生成月牙形数据集并保持确定性', () => {
    const first = generateBuiltinDataset('moons', { samples: 20, noise: 0, seed: 7 })
    const second = generateBuiltinDataset('moons', { samples: 20, noise: 0, seed: 7 })
    expect(first).toEqual(second)
    expect(first.features).toHaveLength(20)
    expect(first.features[0]).toHaveLength(2)
    expect(new Set(first.labels)).toEqual(new Set([0, 1]))
  })

  it('暴露至少五种内置数据集', () => {
    expect(BUILTIN_DATASETS.length).toBeGreaterThanOrEqual(5)
  })
})

describe('多维数据集扩展', () => {
  it('支持任意数量数值特征并保留列名元数据', () => {
    const result = parseCsvDataset('age,height,weight,label\n20,170,60,A\n30,180,80,B', {
      featureColumns: ['age', 'height', 'weight'],
      labelColumn: 'label',
    })
    expect(result.dataset.features).toEqual([[20, 170, 60], [30, 180, 80]])
    expect(result.dataset.featureNames).toEqual(['age', 'height', 'weight'])
    expect(result.dataset.labelName).toBe('label')
  })

  it('未指定列时默认使用除标签列外的所有列', () => {
    const result = parseCsvDataset('a,b,c,label\n1,2,3,A\n4,5,6,B')
    expect(result.dataset.features).toEqual([[1, 2, 3], [4, 5, 6]])
    expect(result.dataset.featureNames).toEqual(['a', 'b', 'c'])
  })

  it('接受三维特征并拒绝维度不一致或非有限值', () => {
    expect(validateDataset({ features: [[1, 2, 3], [4, 5, 6]], labels: ['a', 'b'] })).toEqual({ valid: true, errors: [] })
    expect(validateDataset({ features: [[1, 2, 3], [4, 5]], labels: ['a', 'b'] }).valid).toBe(false)
    expect(validateDataset({ features: [[1, Number.NaN], [4, 5]], labels: ['a', 'b'] }).errors.join('')).toMatch(/有限数值/)
  })
})

describe('CSV 数据集', () => {
  it('解析并清洗二维特征与标签', () => {
    const result = parseCsvDataset('x,y,label\n1,2,A\n3,4,B\n,5,A\nfoo,6,B')
    expect(result.dataset.features).toEqual([[1, 2], [3, 4]])
    expect(result.dataset.labels).toEqual(['A', 'B'])
    expect(result.skippedRows).toBe(2)
  })

  it('缺少有效数据时抛出可读错误', () => {
    expect(() => parseCsvDataset('x,y,label\nfoo,,\n')).toThrow(/至少需要一行有效数据/)
  })
})

describe('数据集预览', () => {
  it('统计样本、特征、标签和特征范围', () => {
    const preview = createDatasetPreview({
      features: [[1, 2], [3, 4], [5, 6]],
      labels: ['A', 'B', 'A'],
    })

    expect(preview).toMatchObject({ sampleCount: 3, featureCount: 2, labelCount: 2, missingCount: 0 })
    expect(preview.featureRanges).toEqual([{ min: 1, max: 5 }, { min: 2, max: 6 }])
    expect(preview.labelDistribution).toEqual([{ label: 'A', count: 2 }, { label: 'B', count: 1 }])
  })

  it('为每个内置数据集提供量级、边界形态或可分性说明', () => {
    for (const { id } of BUILTIN_DATASETS) {
      const metadata = BUILTIN_DATASET_METADATA[id]
      expect(metadata.description).toMatch(/条|样本/)
      expect(metadata.characteristics.length).toBeGreaterThan(0)
    }
  })

  it('生成确定性的十类 8×8 数字图像数据集', () => {
    const first = generateBuiltinDataset('digits', { samples: 100, seed: 7 })
    const second = generateBuiltinDataset('digits', { samples: 100, seed: 7 })

    expect(first).toEqual(second)
    expect(first).toMatchObject({ dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } })
    expect(first.features).toHaveLength(100)
    expect(first.features.every((row) => row.length === 64 && row.every((value) => value >= 0 && value <= 1))).toBe(true)
    expect(new Set(first.labels)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
    expect(generateBuiltinDataset('digits').features).toHaveLength(500)
  })
})

describe('数据集校验', () => {
  it('拒绝非二维特征或长度不一致的数据', () => {
    expect(validateDataset({ features: [[1, 2, 3] as unknown as [number, number]], labels: [0] })).toMatchObject({ valid: false })
    expect(validateDataset({ features: [[1, 2]], labels: [] })).toMatchObject({ valid: false })
  })

  it('接受二分类和多分类二维数据', () => {
    expect(validateDataset({ features: [[1, 2], [3, 4]], labels: ['a', 'b'] })).toEqual({ valid: true, errors: [] })
  })
})

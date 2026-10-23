import { describe, expect, it } from 'vitest'
import { BUILTIN_DATASET_METADATA, BUILTIN_DATASETS, asRegressionDataset, createDatasetPreview, generateBuiltinDataset, parseCsvDataset, validateDataset } from './dataset'

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

  it('生成可复现的四类 32 步单通道波形序列', () => {
    const first = generateBuiltinDataset('sequence-waves', { samples: 16, seed: 13 })
    const second = generateBuiltinDataset('sequence-waves', { samples: 16, seed: 13 })
    expect(first).toEqual(second)
    expect(first).toMatchObject({ dataType: 'sequence', sequenceShape: { steps: 32, channels: 1 } })
    expect(first.features).toHaveLength(16)
    expect(first.features.every(row => row.length === 32 && row.every(Number.isFinite))).toBe(true)
    expect(new Set(first.labels)).toEqual(new Set([0, 1, 2, 3]))
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

describe('回归训练数据集', () => {
  it('将晚于 CSV 导入选择的数值目标安全转换，并保留原分类数据集', () => {
    const dataset = parseCsvDataset('x,target\n1,0.3\n2,1.2').dataset
    const regressionDataset = asRegressionDataset(dataset)

    expect(dataset.labels).toEqual(['0.3', '1.2'])
    expect(regressionDataset.labels).toEqual([0.3, 1.2])
    expect(regressionDataset).not.toBe(dataset)
  })

  it.each([['1', 'unknown'], ['1', 'Infinity'], ['1', '']])('拒绝混合或非有限数值目标 %s', (first, second) => {
    const dataset = { features: [[1], [2]], labels: [first, second], labelName: 'target' }
    expect(() => asRegressionDataset(dataset)).toThrow('CSV 回归目标列“target”必须全部为有限数值')
  })

  it('兼容已有数值标签的内置回归数据集', () => {
    const dataset = { features: [[1], [2]], labels: [2, 4] }
    expect(asRegressionDataset(dataset)).toEqual(dataset)
  })
})

describe('CSV 数据集', () => {
  it('解析并清洗二维特征与标签', () => {
    const result = parseCsvDataset('x,y,label\n1,2,A\n3,4,B\n,5,A\nfoo,6,B')
    expect(result.dataset.features).toEqual([[1, 2], [3, 4]])
    expect(result.dataset.labels).toEqual(['A', 'B'])
    expect(result.skippedRows).toBe(2)
  })

  it('回归模式将有限数值目标转为 number，默认分类标签仍为字符串', () => {
    const csv = 'x1,x2,target\n1,2,3\n2,1,5\n3,4,7\n4,2,8\n5,6,11\n6,3,12\n7,8,15\n8,4,17'
    expect(parseCsvDataset(csv).dataset.labels).toEqual(['3', '5', '7', '8', '11', '12', '15', '17'])
    expect(parseCsvDataset(csv, { labelType: 'numeric' }).dataset.labels).toEqual([3, 5, 7, 8, 11, 12, 15, 17])
  })

  it.each(['1,2,3\n2,4,not-a-number', '1,2,3\n2,4,Infinity', '1,2,3\n2,4,'])('回归模式拒绝混合或非法目标 %s', (rows) => {
    expect(() => parseCsvDataset('x1,x2,target\n' + rows, { labelType: 'numeric' })).toThrow('回归目标列')
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

  it('生成可复现的五类 8×8 几何图形数据集', () => {
    const first = generateBuiltinDataset('shapes', { samples: 50, seed: 19 })
    const second = generateBuiltinDataset('shapes', { samples: 50, seed: 19 })

    expect(first).toEqual(second)
    expect(first).toMatchObject({ dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } })
    expect(first.features).toHaveLength(50)
    expect(first.features.every((row) => row.length === 64 && row.every((value) => value >= 0 && value <= 1))).toBe(true)
    expect(new Set(first.labels)).toEqual(new Set([0, 1, 2, 3, 4]))
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

  it('校验序列数据的时间步与通道数', () => {
    const dataset = generateBuiltinDataset('sequence-waves', { samples: 8 })
    expect(validateDataset(dataset)).toEqual({ valid: true, errors: [] })
    expect(validateDataset({ ...dataset, sequenceShape: { steps: 16, channels: 1 } }).valid).toBe(false)
  })
})

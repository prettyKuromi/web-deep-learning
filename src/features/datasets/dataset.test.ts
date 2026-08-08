import { describe, expect, it } from 'vitest'
import { BUILTIN_DATASETS, generateBuiltinDataset, parseCsvDataset, validateDataset } from './dataset'

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

describe('数据集校验', () => {
  it('拒绝非二维特征或长度不一致的数据', () => {
    expect(validateDataset({ features: [[1, 2, 3] as unknown as [number, number]], labels: [0] })).toMatchObject({ valid: false })
    expect(validateDataset({ features: [[1, 2]], labels: [] })).toMatchObject({ valid: false })
  })

  it('接受二分类和多分类二维数据', () => {
    expect(validateDataset({ features: [[1, 2], [3, 4]], labels: ['a', 'b'] })).toEqual({ valid: true, errors: [] })
  })
})

import { describe, expect, it } from 'vitest'
import { profileDataset } from './profiling'

describe('数据集剖析', () => {
  it('计算类别分布和特征统计值', () => {
    const profile = profileDataset({ name: '示例', featureNames: ['年龄', '收入'], features: [[1, 10], [3, 30], [5, 50]], labels: ['A', 'A', 'B'] })
    expect(profile.classDistribution).toEqual([
      { label: 'A', count: 2, ratio: 2 / 3 },
      { label: 'B', count: 1, ratio: 1 / 3 },
    ])
    expect(profile.features[0]).toMatchObject({ name: '年龄', min: 1, max: 5, mean: 3, nonFiniteCount: 0 })
    expect(profile.features[1].standardDeviation).toBeCloseTo(Math.sqrt(800 / 3))
  })

  it('对非有限值保留上下文并给出中文提醒', () => {
    const profile = profileDataset({ features: [[1, Number.NaN], [2, 4]], labels: ['A', 'B'] })
    expect(profile.features[1].nonFiniteCount).toBe(1)
    expect(profile.features[1].min).toBe(4)
    expect(profile.warnings.join('')).toContain('非有限值')
  })
})

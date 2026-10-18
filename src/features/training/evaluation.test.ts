import { describe, expect, it } from 'vitest'
import { classificationEvaluation, regressionMetrics, selectLabels, selectRows, splitDataset } from './evaluation'

describe('evaluation utilities', () => {
  it('creates deterministic stratified splits and keeps each class in train', () => {
    const labels = ['a', 'a', 'a', 'b', 'b', 'b']
    const first = splitDataset(labels, { validationSplit: 0.33, seed: 7 }, 'classification')
    const second = splitDataset(labels, { validationSplit: 0.33, seed: 7 }, 'classification')
    expect(first).toEqual(second)
    expect(new Set(selectLabels(labels, first.trainIndices))).toEqual(new Set(['a', 'b']))
    expect(first.validationIndices).toHaveLength(2)
  })

  it('rejects a split that cannot produce a validation row', () => {
    expect(() => splitDataset(['a'], { validationSplit: 0.2, seed: 1 }, 'classification')).toThrow('至少需要 2')
  })

  it('calculates regression metrics', () => {
    expect(regressionMetrics([1, 2, 3], [1, 3, 2])).toEqual({ mae: 2 / 3, mse: 2 / 3, r2: 0 })
  })

  it('returns classification metrics with sample counts', () => {
    const result = classificationEvaluation(['a', 'b'], ['a', 'a'], 4)
    expect(result.train.sampleCount).toBe(2)
    expect(result.evaluatedAtStep).toBe(4)
    expect('accuracy' in result.train.metrics && result.train.metrics.accuracy).toBe(0.5)
  })

  it('selects matching sample and label rows', () => {
    expect(selectRows([[1], [2], [3]], [2, 0])).toEqual([[3], [1]])
    expect(selectLabels(['a', 'b', 'c'], [2, 0])).toEqual(['c', 'a'])
  })
})

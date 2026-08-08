import { describe, expect, it } from 'vitest'
import {
  buildScatterPlotData,
  createDecisionBoundaryGrid,
  getPlotBounds,
  normalizePoint,
} from './plotData'

describe('plot data helpers', () => {
  it('computes padded bounds and normalizes points into the unit square', () => {
    const features = [[0, 0], [10, 20]] as const
    const bounds = getPlotBounds(features, 0.1)

    expect(bounds).toEqual({ minX: -1, maxX: 11, minY: -2, maxY: 22 })
    expect(normalizePoint([5, 10], bounds)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('builds scatter points and associates optional predictions', () => {
    const result = buildScatterPlotData([[1, 2], [3, 4]], ['a', 'b'], ['a', 'c'])

    expect(result.points).toEqual([
      { x: 1, y: 2, label: 'a', prediction: 'a', correct: true },
      { x: 3, y: 4, label: 'b', prediction: 'c', correct: false },
    ])
    expect(result.bounds.minX).toBeLessThan(1)
  })

  it('generates a decision boundary grid and predicts every cell', () => {
    const features = [[0, 0], [1, 1]] as const
    const grid = createDecisionBoundaryGrid(features, (point) => point[0] > 0.5 ? 1 : 0, { resolution: 3 })

    expect(grid.resolution).toBe(3)
    expect(grid.cells).toHaveLength(9)
    expect(new Set(grid.cells.map((cell) => cell.label))).toEqual(new Set([0, 1]))
  })

  it('rejects predictions whose length differs from features', () => {
    expect(() => buildScatterPlotData([[1, 2]], [0], [])).toThrow('predictions length')
  })
})

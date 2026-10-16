import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CurrentResultPanel } from './CurrentResultPanel'
import { classificationMetrics } from '../training/metrics'
vi.mock('../visualization/DecisionBoundaryChart', () => ({ DecisionBoundaryChart: ({ predict }: { predict?: unknown }) => <div data-testid="chart" data-boundary={Boolean(predict)} /> }))
afterEach(cleanup)
it('高维结果只画投影且不向高维模型传入二维边界点', () => {
  render(<CurrentResultPanel result={{ dataset: { features: [[0, 1, 2], [1, 2, 3]], labels: ['a', 'b'] }, predictions: ['a', 'b'], metrics: classificationMetrics(['a', 'b'], ['a', 'b']), predict: vi.fn() }} />)
  expect(screen.getByTestId('chart')).toHaveAttribute('data-boundary', 'false')
  expect(screen.getByText(/不代表真实的高维决策边界/)).toBeInTheDocument()
})

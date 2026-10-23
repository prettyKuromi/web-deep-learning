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

it('用提示解释分类指标及宏平均口径', () => {
  render(<CurrentResultPanel result={{ dataset: { features: [[0, 1], [1, 2]], labels: ['a', 'b'] }, predictions: ['a', 'b'], metrics: classificationMetrics(['a', 'b'], ['a', 'b']) }} />)
  expect(screen.getByText('精确率').parentElement).toHaveAttribute('title', expect.stringContaining('宏平均'))
  expect(screen.getByText('召回率').parentElement).toHaveAttribute('title', expect.stringContaining('找出'))
  expect(screen.getByText('F1').parentElement).toHaveAttribute('title', expect.stringContaining('调和平均'))
})

it('时序分类结果不显示二维投影或逐特征预测表单', () => {
  render(<CurrentResultPanel result={{
    dataset: { features: [Array(32).fill(0), Array(32).fill(1)], labels: [0, 1], dataType: 'sequence', sequenceShape: { steps: 32, channels: 1 } },
    predictions: [0, 1], metrics: classificationMetrics([0, 1], [0, 1]), predict: vi.fn(),
  }} />)
  expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('交互式预测')).not.toBeInTheDocument()
})

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DecisionBoundaryChart } from './DecisionBoundaryChart'

describe('DecisionBoundaryChart', () => {
  afterEach(() => cleanup())

  it('将样本数、类别分布和特征投影作为图表的可访问描述', () => {
    render(<DecisionBoundaryChart
      features={[[0, 1], [1, 2], [2, 1], [3, 2]]}
      labels={['猫', '猫', '狗', '鸟']}
    />)

    const chart = screen.getByRole('img', { name: '二维数据散点图' })
    expect(chart).toHaveAccessibleDescription('样本数：4。类别数：3。类别分布：“猫” 2 个，“狗” 1 个，“鸟” 1 个。二维投影：横轴为特征 1，纵轴为特征 2。')
    expect(chart).toHaveAttribute('aria-describedby')
  })

  it('标签更新后同步更新可访问摘要', () => {
    const { rerender } = render(<DecisionBoundaryChart features={[[0, 1], [1, 2]]} labels={['A', 'B']} />)
    const chart = screen.getByRole('img', { name: '二维数据散点图' })
    expect(chart).toHaveAccessibleDescription(/样本数：2。类别数：2。类别分布：“A” 1 个，“B” 1 个。/)

    rerender(<DecisionBoundaryChart features={[[0, 1], [1, 2], [2, 3]]} labels={['A', 'A', 'A']} />)
    expect(chart).toHaveAccessibleDescription(/样本数：3。类别数：1。类别分布：“A” 3 个。/)
  })

  it('提供决策函数时，在可访问名称中标明决策边界', () => {
    render(<DecisionBoundaryChart
      features={[[0, 1], [1, 2]]}
      labels={['A', 'B']}
      predict={([x]) => x > 0.5 ? 'B' : 'A'}
    />)

    expect(screen.getByRole('img', { name: '二维数据散点图与决策边界' })).toBeInTheDocument()
  })

  it('区分文本标签和数字标签的相同显示值', () => {
    render(<DecisionBoundaryChart features={[[0, 1], [1, 2]]} labels={[1, '1']} />)

    expect(screen.getByRole('img', { name: '二维数据散点图' })).toHaveAccessibleDescription(/类别数：2。类别分布：1 1 个，“1” 1 个。/)
  })
})

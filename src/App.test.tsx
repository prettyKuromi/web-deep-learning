import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('实验工作台壳层', () => {
  it('显示四个流程阶段并能切换当前阶段', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: /01 数据集/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /03 训练/ }))
    expect(screen.getByText('CURRENT STAGE · 训练')).toBeInTheDocument()
  })
})

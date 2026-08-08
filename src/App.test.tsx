import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

describe('实验工作台壳层', () => {
  afterEach(() => cleanup())
  it('显示四个流程阶段并能切换当前阶段', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: /01 数据集/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /03 训练/ }))
    expect(screen.getByRole('button', { name: /03 训练/ })).toHaveClass('active')
  })

  it('允许选择数据集并运行 KNN 训练', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getAllByRole('heading', { name: '选择数据集' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '训练 KNN' }))
    expect(await screen.findByRole('status')).toHaveTextContent('训练完成')
  })
})

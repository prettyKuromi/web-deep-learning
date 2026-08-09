import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { useWorkbenchStore } from './app/workbenchStore'

describe('实验工作台', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.getState().reset()
  })

  it('默认显示数据集阶段并提供后续阶段导航', () => {
    render(<App />)
    expect(screen.getAllByRole('heading', { name: '选择数据集' })).toHaveLength(2)
    expect(screen.getByRole('tab', { name: /模型/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '选择模型与参数' })).not.toBeInTheDocument()
  })

  it('支持调整 KNN 参数并显示训练损失曲线', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: /模型/ }))
    await user.click(screen.getByRole('radio', { name: 'KNN' }))
    const k = screen.getByRole('spinbutton', { name: '邻居数（k）' })
    await user.clear(k)
    await user.type(k, '3')
    expect(k).toHaveValue(3)
    await user.click(screen.getByRole('tab', { name: /训练/ }))
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    expect(await screen.findAllByText('训练完成')).not.toHaveLength(0)
    expect(screen.getByRole('tab', { name: /训练/ })).toHaveAttribute('aria-selected', 'true')
  })
})

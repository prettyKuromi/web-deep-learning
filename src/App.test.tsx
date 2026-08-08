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

  it('在单页面展示数据集、模型、训练和结果区域', () => {
    render(<App />)
    expect(screen.getAllByRole('heading', { name: '选择数据集' })).toHaveLength(2)
    expect(screen.getByRole('heading', { name: '选择模型与参数' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '训练过程' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '实验结果' })).toBeInTheDocument()
  })

  it('支持调整 KNN 参数并显示训练损失曲线', async () => {
    const user = userEvent.setup()
    render(<App />)
    const k = screen.getByRole('spinbutton', { name: '邻居数（k）' })
    await user.clear(k)
    await user.type(k, '3')
    expect(k).toHaveValue(3)
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('训练完成')
    expect(screen.getByRole('img', { name: '训练损失曲线' })).toBeInTheDocument()
  })
})

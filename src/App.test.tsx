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

  it('默认在同一页面显示实验配置、训练过程和模型解释', () => {
    render(<App />)
    expect(screen.getByRole('complementary', { name: '实验配置' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: '训练画布' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '模型解释与结果' })).toBeInTheDocument()
  })

  it('支持调整 KNN 参数并显示训练损失曲线', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByRole('combobox', { name: '训练模型' }), 'knn')
    const k = screen.getByRole('spinbutton', { name: '邻居数（k）' })
    await user.clear(k)
    await user.type(k, '3')
    expect(k).toHaveValue(3)
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    expect(await screen.findAllByText('训练完成')).not.toHaveLength(0)
    expect(screen.getByRole('main', { name: '训练画布' })).toBeInTheDocument()
  })
})

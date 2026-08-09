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

  it('默认显示数据集选择页，并可进入实验流程', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '数据集' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))
    expect(screen.getByRole('main', { name: '训练画布' })).toBeInTheDocument()
  })

  it('支持调整 KNN 参数并显示训练损失曲线', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '训练模型' }), 'knn')
    const k = screen.getByRole('spinbutton', { name: '邻居数（k）' })
    await user.clear(k)
    await user.type(k, '3')
    expect(k).toHaveValue(3)
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    expect(await screen.findAllByText('训练完成')).not.toHaveLength(0)
    expect(screen.getByRole('main', { name: '训练画布' })).toBeInTheDocument()
  })

  it('更换数据集后清空当前训练结果并保留模型配置', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '训练模型' }), 'knn')
    await user.click(screen.getByRole('button', { name: '更换数据集' }))
    expect(screen.getByRole('heading', { name: '数据集' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('内置数据集'), 'xor')
    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))
    expect(screen.getByRole('combobox', { name: '训练模型' })).toHaveValue('knn')
    expect(screen.getByText('请重新训练')).toBeInTheDocument()
  })
})

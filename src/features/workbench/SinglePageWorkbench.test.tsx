import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SinglePageWorkbench } from './SinglePageWorkbench'

describe('单页训练工作台', () => {
  afterEach(cleanup)
  const baseProps = {
    model: 'logistic-regression' as const,
    params: { learningRate: 0.1, iterations: 20, regularization: 0.001 },
    status: '等待训练',
    snapshots: [],
    onDatasetChange: vi.fn(),
    onModelChange: vi.fn(),
    onParamsChange: vi.fn(),
    onStartTraining: vi.fn(),
  }

  it('将配置、训练画布和模型解释同屏展示', () => {
    render(<SinglePageWorkbench {...baseProps} />)

    expect(screen.getByRole('complementary', { name: '实验配置' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: '训练画布' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '模型解释与结果' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '训练模型' })).toHaveValue('logistic-regression')
  })

  it('切换模型并触发训练控制回调', async () => {
    const user = userEvent.setup()
    const onModelChange = vi.fn()
    const onPauseTraining = vi.fn()
    const onStepTraining = vi.fn()
    const onResumeTraining = vi.fn()
    const onStopTraining = vi.fn()
    const onResetTraining = vi.fn()
    const onStartTraining = vi.fn()
    render(<SinglePageWorkbench {...baseProps} onModelChange={onModelChange} onStartTraining={onStartTraining} onPauseTraining={onPauseTraining} onStepTraining={onStepTraining} onResumeTraining={onResumeTraining} onStopTraining={onStopTraining} onResetTraining={onResetTraining} />)

    await user.selectOptions(screen.getByRole('combobox', { name: '训练模型' }), 'mlp')
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    await user.click(screen.getByRole('button', { name: '暂停' }))
    await user.click(screen.getByRole('button', { name: '单步' }))
    await user.click(screen.getByRole('button', { name: '继续' }))
    await user.click(screen.getByRole('button', { name: '停止' }))
    await user.click(screen.getByRole('button', { name: '重置' }))

    expect(onModelChange).toHaveBeenCalledWith('mlp')
    expect(onStartTraining).toHaveBeenCalledOnce()
    expect(onPauseTraining).toHaveBeenCalledOnce()
    expect(onStepTraining).toHaveBeenCalledOnce()
    expect(onResumeTraining).toHaveBeenCalledOnce()
    expect(onStopTraining).toHaveBeenCalledOnce()
    expect(onResetTraining).toHaveBeenCalledOnce()
  })

  it('未选择模型时给出中文错误提示', async () => {
    const user = userEvent.setup()
    render(<SinglePageWorkbench {...baseProps} model={undefined} />)

    await user.click(screen.getByRole('button', { name: '开始训练' }))

    expect(screen.getByRole('alert')).toHaveTextContent('请先选择模型')
  })
})

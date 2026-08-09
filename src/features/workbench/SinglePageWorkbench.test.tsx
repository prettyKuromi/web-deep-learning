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
    datasetName: '月牙形',
    onChangeDataset: vi.fn(),
    onModelChange: vi.fn(),
    onParamsChange: vi.fn(),
    onStartTraining: vi.fn(),
  }

  it('将配置、训练画布和模型解释同屏展示', () => {
    render(<SinglePageWorkbench {...baseProps} />)

    expect(screen.getByRole('complementary', { name: '实验配置' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: '训练画布' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '模型解释与结果' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '分类' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('logistic-regression')
    expect(screen.getByRole('complementary', { name: '实验配置' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: '训练画布' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '模型解释与结果' })).toBeInTheDocument()
    expect(screen.getAllByText('月牙形').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '更换数据集' })).toBeInTheDocument()
    expect(document.querySelector('.single-page-workbench--four-columns')).not.toBeInTheDocument()
  })

  it('以步骤侧栏和紧凑数据集上下文组织实验流程', () => {
    render(<SinglePageWorkbench {...baseProps} />)

    expect(screen.getByRole('navigation', { name: '实验步骤' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /数据集.*月牙形/ })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '模型' })).toHaveAttribute('data-state', 'active')
    const datasetBar = screen.getByRole('region', { name: '当前数据集' })
    expect(datasetBar).toHaveTextContent('月牙形')
    expect(datasetBar.querySelector('button')).toHaveTextContent('更换数据集')
    expect(datasetBar.className).toContain('workflow-context-bar')
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

    await user.click(screen.getByRole('tab', { name: '分类' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '具体模型' }), 'mlp')
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    expect(screen.getByRole('button', { name: '暂停' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '继续' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '停止' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '重置' })).toBeDisabled()

    expect(onModelChange).toHaveBeenCalledWith('mlp')
    expect(onStartTraining).toHaveBeenCalledOnce()
    expect(onPauseTraining).not.toHaveBeenCalled()
    expect(onStepTraining).not.toHaveBeenCalled()
    expect(onResumeTraining).not.toHaveBeenCalled()
    expect(onStopTraining).not.toHaveBeenCalled()
    expect(onResetTraining).not.toHaveBeenCalled()
  })

  it('未选择模型时给出中文错误提示', async () => {
    const user = userEvent.setup()
    render(<SinglePageWorkbench {...baseProps} model={undefined} />)

    await user.click(screen.getByRole('button', { name: '开始训练' }))

    expect(screen.getByRole('alert')).toHaveTextContent('请先选择模型')
  })
})

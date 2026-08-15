import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SinglePageWorkbench } from './SinglePageWorkbench'
import { defaultVisualLayers } from '../training/visualNetwork'

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
    expect(document.querySelector('.single-page-workbench--immersive')).toBeInTheDocument()
  })

  it('在图像网络结构无效时禁用开始训练', () => {
    render(<SinglePageWorkbench model="visual-cnn" params={{}} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={[...defaultVisualLayers(), { id: 'pool-2', type: 'max-pool' }, { id: 'pool-3', type: 'max-pool' }]} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />)
    expect(screen.getByRole('button', { name: '开始训练' })).toBeDisabled()
  })

  it('在训练主面板展示 CNN 构建器，并让左侧保留训练参数', () => {
    render(<SinglePageWorkbench model="visual-cnn" params={{ learningRate: 0.03, epochs: 40, batchSize: 20, seed: 42 }} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0), Array(64).fill(1)], labels: [0, 1], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />)

    const canvas = screen.getByRole('main', { name: '训练画布' })
    const config = screen.getByRole('complementary', { name: '实验配置' })
    expect(within(canvas).getByRole('region', { name: '网络结构搭建器' })).toBeInTheDocument()
    expect(within(config).queryByRole('region', { name: '网络结构搭建器' })).not.toBeInTheDocument()
    expect(within(config).getByRole('spinbutton', { name: '学习率' })).toHaveValue(0.03)
    expect(within(config).getByRole('spinbutton', { name: '训练轮数' })).toHaveValue(40)
    expect(within(config).getByRole('spinbutton', { name: '批大小' })).toHaveValue(20)
    expect(within(config).getByRole('spinbutton', { name: '随机种子' })).toHaveValue(42)
    expect(screen.getByTestId('cnn-training-card')).toHaveClass('training-canvas-card--cnn')
  })

  it('移除实验步骤卡片并保留配置与数据集上下文', () => {
    render(<SinglePageWorkbench {...baseProps} />)

    expect(screen.queryByRole('navigation', { name: '实验步骤' })).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '实验配置' })).toBeInTheDocument()
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

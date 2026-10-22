import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SinglePageWorkbench } from './SinglePageWorkbench'
import { defaultVisualLayers } from '../training/visualNetwork'

describe('单页训练工作台', () => {
  afterEach(cleanup)

  it.each(['训练完成', '训练已停止', '训练失败'])('终态 %s 禁止继续、单步与停止', (status) => {
    render(<SinglePageWorkbench {...baseProps} status={status} snapshots={[{ iteration: 0 }]} />)
    for (const name of ['暂停', '继续', '单步', '停止']) expect(screen.getByRole('button', { name })).toBeDisabled()
    expect(screen.getByRole('button', { name: '开始训练' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '重置' })).toBeEnabled()
  })

  it('运行与暂停期间的控制按钮随状态变化', () => {
    const { rerender } = render(<SinglePageWorkbench {...baseProps} status="训练中…" snapshots={[]} />)
    expect(screen.getByRole('button', { name: '开始训练' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '暂停' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '单步' })).toBeDisabled()
    rerender(<SinglePageWorkbench {...baseProps} status="训练已暂停" snapshots={[]} />)
    expect(screen.getByRole('button', { name: '暂停' })).toBeDisabled()
    for (const name of ['继续', '单步', '停止']) expect(screen.getByRole('button', { name })).toBeEnabled()
  })

  it('非迭代模型完成时展示拟合完成时间线', () => {
    render(<SinglePageWorkbench {...baseProps} model="knn" status="训练完成" snapshots={[{ iteration: 0 }]} />)
    expect(screen.queryByText('第 0 次迭代')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('已完成拟合')
  })
  it('训练中展示来自快照的当前迭代、进度和损失', () => {
    render(<SinglePageWorkbench {...baseProps} status="训练中…" capability={{ unit: 'iteration', total: 20, canPause: true, canStep: true, canStop: true }} snapshots={[{ iteration: 4, loss: 0.25, metrics: { accuracy: .8, precision: .75, recall: .7, f1: .72, labels: [0, 1], confusionMatrix: [[4, 1], [1, 4]] } }]} />)
    expect(screen.getByText('第 4 / 20 迭代')).toBeInTheDocument()
    expect(screen.getByText('当前损失：0.2500')).toBeInTheDocument()
    expect(screen.getByLabelText('训练进度')).toHaveAttribute('value', '20')
    expect(screen.getByText(/准确率 80.0%/)).toBeInTheDocument()
  })
  it('按训练器能力展示树单位并禁用不支持的暂停与单步', () => {
    render(<SinglePageWorkbench {...baseProps} model="random-forest" params={{ trees: 5 }} status="训练中…" capability={{ unit: 'tree', total: 5, canPause: false, canStep: false, canStop: true }} snapshots={[{ iteration: 2, loss: .3 }]} />)
    expect(screen.getByText('第 2 / 5 树')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '暂停' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '单步' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled()
  })
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

  it('在训练画布直接展示可编辑 CNN 网络，并把开始按钮放在配置栏', () => {
    render(<SinglePageWorkbench model="visual-cnn" params={{ learningRate: 0.03, epochs: 40, batchSize: 20, seed: 42 }} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0), Array(64).fill(1)], labels: [0, 1], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />)

    const canvas = screen.getByRole('main', { name: '训练画布' })
    const config = screen.getByRole('complementary', { name: '实验配置' })
    expect(within(canvas).getByLabelText('神经网络数据流')).toBeInTheDocument()
    expect(within(canvas).getByRole('button', { name: /在激活层.*第 2 层.*前插入/ })).toBeInTheDocument()
    expect(within(config).queryByRole('region', { name: '网络结构搭建器' })).not.toBeInTheDocument()
    expect(within(config).getByRole('button', { name: '开始训练' })).toBeInTheDocument()
    expect(within(canvas).queryByRole('button', { name: '开始训练' })).not.toBeInTheDocument()
    expect(within(config).getByRole('spinbutton', { name: '学习率' })).toHaveValue(0.03)
    expect(within(config).getByRole('spinbutton', { name: '训练轮数' })).toHaveValue(40)
    expect(within(config).getByRole('spinbutton', { name: '批大小' })).toHaveValue(20)
    expect(within(config).getByRole('spinbutton', { name: '随机种子' })).toHaveValue(42)
    expect(screen.getByTestId('cnn-training-card')).toHaveClass('training-canvas-card--cnn')
    expect(within(canvas).getByLabelText('神经网络数据流').parentElement).toHaveClass('single-page-chart--cnn')
  })

  it('CNN 空快照时预留固定时间线卡片，普通模型保持按需显示', () => {
    const cnn = <SinglePageWorkbench model="visual-cnn" params={{ epochs: 40 }} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />
    const { rerender } = render(cnn)

    const canvas = screen.getByRole('main', { name: '训练画布' })
    expect(canvas).toHaveClass('single-page-canvas--cnn')
    expect(within(canvas).getByRole('heading', { name: '训练时间线' })).toBeInTheDocument()
    expect(within(canvas).getByRole('heading', { name: '训练时间线' }).closest('section')).toHaveClass('single-page-timeline-card')

    rerender(<SinglePageWorkbench {...baseProps} snapshots={[]} />)
    expect(screen.queryByRole('heading', { name: '训练时间线' })).not.toBeInTheDocument()
  })

  it('图像模型只显示当前数据兼容的分类任务与模型', () => {
    render(<SinglePageWorkbench model="visual-cnn" params={{ epochs: 40 }} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0), Array(64).fill(1)], labels: [0, 1], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />)

    expect(screen.queryByRole('tab', { name: '回归' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'KNN' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: '可视化卷积神经网络' })).toBeInTheDocument()
  })

  it('没有迭代损失时在训练主画布呈现最终结果', () => {
    render(<SinglePageWorkbench {...baseProps} model="knn" status="训练完成" snapshots={[{ iteration: 1 }]} resultPanel={<div>最终分类结果图</div>} />)

    expect(screen.getByRole('main', { name: '训练画布' })).toHaveTextContent('最终分类结果图')
  })

  it('CNN 完成后在主画布展示结果而非隐藏结果面板', () => {
    render(<SinglePageWorkbench {...baseProps} model="visual-cnn" status="训练完成" snapshots={[{ iteration: 1 }]} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} resultPanel={<div>图像分类结果</div>} />)

    expect(screen.getByRole('main', { name: '训练画布' })).toHaveTextContent('图像分类结果')
    expect(screen.queryByLabelText('神经网络数据流')).not.toBeInTheDocument()
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

  it('未选择模型时禁用开始训练', () => {
    render(<SinglePageWorkbench {...baseProps} model={undefined} />)
    expect(screen.getByRole('button', { name: '开始训练' })).toBeDisabled()
  })
})

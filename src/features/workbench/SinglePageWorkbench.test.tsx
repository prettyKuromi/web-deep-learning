import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

  it('将解释与结果放在画布页签，并使用两栏主布局', async () => {
    const user = userEvent.setup()
    render(<SinglePageWorkbench {...baseProps} />)

    expect(screen.getByRole('complementary', { name: '实验配置' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: '训练画布' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: '模型解释与结果' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '分类' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '训练过程' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('logistic-regression')
    expect(screen.getByRole('main', { name: '训练画布' })).toHaveClass('single-page-canvas--two-columns')
    expect(screen.getAllByText('月牙形').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '更换数据集' })).toBeInTheDocument()
    expect(document.querySelector('.single-page-workbench--four-columns')).not.toBeInTheDocument()
    expect(document.querySelector('.single-page-workbench--immersive')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '结果与解释' }))
    expect(screen.getByRole('tab', { name: '结果与解释' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('main', { name: '训练画布' }).querySelector('.workflow-dataset-header h2')).toHaveTextContent('模型解释与结果')
    expect(screen.getByRole('region', { name: '模型解释与结果' })).toHaveTextContent('训练后将展示模型结构、关键参数和决策过程。')
  })

  it('训练画布空态不再显示数据投影，组件重入后回到训练页签', async () => {
    const user = userEvent.setup()
    const dataset = { features: [[0, 0], [1, 1]], labels: [0, 1], dataType: 'tabular' as const }
    const { unmount } = render(<SinglePageWorkbench {...baseProps} dataset={dataset} />)

    expect(screen.getByText('开始训练后，这里会显示损失变化。')).toBeInTheDocument()
    expect(screen.queryByText('当前数据投影')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '结果与解释' }))
    unmount()

    render(<SinglePageWorkbench {...baseProps} dataset={dataset} />)
    expect(screen.getByRole('tab', { name: '训练过程' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('开始训练后，这里会显示损失变化。')).toBeInTheDocument()
  })

  it('训练未完成时不展示遗留的结果面板或当前结果', async () => {
    const user = userEvent.setup()
    const staleResult = {
      dataset: { features: [[0, 0]], labels: [0], dataType: 'tabular' as const },
      predictions: [0],
      metrics: { accuracy: 1, precision: 1, recall: 1, f1: 1, labels: [0], confusionMatrix: [[1]] },
    }
    render(<SinglePageWorkbench {...baseProps} status="训练中…" resultPanel={<div>遗留结果面板</div>} currentResult={staleResult} />)

    await user.click(screen.getByRole('tab', { name: '结果与解释' }))
    const results = screen.getByRole('region', { name: '模型解释与结果' })
    expect(results).not.toHaveTextContent('遗留结果面板')
    expect(results).not.toHaveTextContent('当前结果')
    expect(results).toHaveTextContent('训练完成后，这里会显示本轮实验的评估结果。')
  })

  it('画布页签支持方向键、Home 与 End 导航', async () => {
    const user = userEvent.setup()
    render(<SinglePageWorkbench model="visual-cnn" params={{}} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />)

    const training = screen.getByRole('tab', { name: '训练过程' })
    const results = screen.getByRole('tab', { name: '结果与解释' })
    const architecture = screen.getByRole('tab', { name: '网络结构' })
    expect(training).toHaveAttribute('tabindex', '0')
    expect(results).toHaveAttribute('tabindex', '-1')
    await user.click(training)
    await user.keyboard('{ArrowRight}')
    expect(results).toHaveFocus()
    expect(results).toHaveAttribute('aria-selected', 'true')
    expect(fireEvent.keyDown(results, { key: 'ArrowDown' })).toBe(true)
    expect(results).toHaveFocus()
    expect(results).toHaveAttribute('aria-selected', 'true')
    expect(fireEvent.keyDown(results, { key: 'ArrowUp' })).toBe(true)
    expect(results).toHaveFocus()
    await user.keyboard('{Home}')
    expect(training).toHaveFocus()
    await user.keyboard('{End}')
    expect(architecture).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(results).toHaveFocus()
  })

  it('任务类型页签支持左右方向键、Home 与 End 导航', async () => {
    const user = userEvent.setup()
    render(<SinglePageWorkbench {...baseProps} />)

    const taskTabs = within(screen.getByRole('tablist', { name: '任务类型' })).getAllByRole('tab')
    expect(taskTabs[0]).toHaveAttribute('tabindex', '0')
    expect(taskTabs.slice(1).every((tab) => tab.getAttribute('tabindex') === '-1')).toBe(true)
    await user.click(taskTabs[0])
    await user.keyboard('{ArrowRight}')
    expect(taskTabs[1]).toHaveFocus()
    expect(taskTabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(taskTabs[1]).toHaveAttribute('tabindex', '0')
    expect(taskTabs[0]).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{Home}')
    expect(taskTabs[0]).toHaveFocus()
    expect(taskTabs[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(taskTabs.at(-1)).toHaveFocus()
    expect(taskTabs.at(-1)).toHaveAttribute('aria-selected', 'true')
  })

  it('开始训练和重置训练时自动切回训练过程页签', async () => {
    const user = userEvent.setup()
    const onStartTraining = vi.fn()
    const onResetTraining = vi.fn()
    const { rerender } = render(<SinglePageWorkbench {...baseProps} onStartTraining={onStartTraining} onResetTraining={onResetTraining} />)

    await user.click(screen.getByRole('tab', { name: '结果与解释' }))
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    expect(onStartTraining).toHaveBeenCalledOnce()
    expect(screen.getByRole('tab', { name: '训练过程' })).toHaveAttribute('aria-selected', 'true')

    rerender(<SinglePageWorkbench {...baseProps} status="训练完成" snapshots={[{ iteration: 1 }]} onStartTraining={onStartTraining} onResetTraining={onResetTraining} />)
    await user.click(screen.getByRole('tab', { name: '结果与解释' }))
    await user.click(screen.getByRole('button', { name: '重置' }))
    expect(onResetTraining).toHaveBeenCalledOnce()
    expect(screen.getByRole('tab', { name: '训练过程' })).toHaveAttribute('aria-selected', 'true')
  })

  it('在图像网络结构无效时禁用开始训练', () => {
    render(<SinglePageWorkbench model="visual-cnn" params={{}} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={[...defaultVisualLayers(), { id: 'pool-2', type: 'max-pool' }, { id: 'pool-3', type: 'max-pool' }]} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />)
    expect(screen.getByRole('button', { name: '开始训练' })).toBeDisabled()
  })

  it('CNN 默认显示空训练画布，并可在独立页签编辑网络结构', async () => {
    const user = userEvent.setup()
    render(<SinglePageWorkbench model="visual-cnn" params={{ learningRate: 0.03, epochs: 40, batchSize: 20, seed: 42 }} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0), Array(64).fill(1)], labels: [0, 1], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />)

    const canvas = screen.getByRole('main', { name: '训练画布' })
    const config = screen.getByRole('complementary', { name: '实验配置' })
    expect(within(canvas).getByRole('tab', { name: '训练过程' })).toHaveAttribute('aria-selected', 'true')
    expect(within(canvas).getByText('开始训练后，这里会显示损失变化。')).toBeInTheDocument()
    expect(within(canvas).queryByLabelText('神经网络数据流')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '网络结构' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '网络结构' }))
    expect(canvas.querySelector('.workflow-dataset-header h2')).toHaveTextContent('CNN 网络结构')
    expect(within(canvas).getByLabelText('神经网络数据流')).toBeInTheDocument()
    expect(within(canvas).getByRole('button', { name: /在激活层.*第 2 层.*前插入/ })).toBeInTheDocument()
    expect(within(config).queryByRole('region', { name: '网络结构搭建器' })).not.toBeInTheDocument()
    expect(within(config).getByRole('button', { name: '开始训练' })).toBeInTheDocument()
    expect(within(canvas).queryByRole('button', { name: '开始训练' })).not.toBeInTheDocument()
    expect(within(config).getByRole('spinbutton', { name: '学习率' })).toHaveValue(0.03)
    expect(within(config).getByRole('spinbutton', { name: '训练轮数' })).toHaveValue(40)
    expect(within(config).getByRole('spinbutton', { name: '批大小' })).toHaveValue(20)
    expect(within(config).getByRole('spinbutton', { name: '随机种子' })).toHaveValue(42)
    expect(within(canvas).getByLabelText('神经网络数据流').parentElement).toHaveClass('single-page-architecture')
  })

  it('只有收到快照后才在训练页显示时间线', () => {
    const cnn = <SinglePageWorkbench model="visual-cnn" params={{ epochs: 40 }} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />
    const { rerender } = render(cnn)

    const canvas = screen.getByRole('main', { name: '训练画布' })
    expect(canvas).toHaveClass('single-page-canvas--two-columns')
    expect(within(canvas).queryByRole('heading', { name: '训练时间线' })).not.toBeInTheDocument()

    rerender(<SinglePageWorkbench {...baseProps} model="visual-cnn" status="训练中…" snapshots={[{ iteration: 1, loss: 0.4 }]} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} />)
    expect(within(canvas).getByRole('heading', { name: '训练时间线' })).toBeInTheDocument()
  })

  it('图像模型只显示当前数据兼容的分类任务与模型', () => {
    render(<SinglePageWorkbench model="visual-cnn" params={{ epochs: 40 }} status="等待训练" snapshots={[]} dataset={{ features: [Array(64).fill(0), Array(64).fill(1)], labels: [0, 1], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} onDatasetChange={vi.fn()} onModelChange={vi.fn()} onParamsChange={vi.fn()} onStartTraining={vi.fn()} />)

    expect(screen.queryByRole('tab', { name: '回归' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'KNN' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: '可视化卷积神经网络' })).toBeInTheDocument()
  })

  it('没有迭代损失时仍可在结果页查看最终结果', async () => {
    const user = userEvent.setup()
    render(<SinglePageWorkbench {...baseProps} model="knn" status="训练完成" snapshots={[{ iteration: 1 }]} resultPanel={<div>最终分类结果图</div>} />)

    expect(screen.getByRole('main', { name: '训练画布' })).not.toHaveTextContent('最终分类结果图')
    await user.click(screen.getByRole('tab', { name: '结果与解释' }))
    expect(screen.getByRole('region', { name: '模型解释与结果' })).toHaveTextContent('最终分类结果图')
  })

  it('CNN 完成后训练图和结果分别位于对应页签', async () => {
    const user = userEvent.setup()
    render(<SinglePageWorkbench {...baseProps} model="visual-cnn" status="训练完成" snapshots={[{ iteration: 1 }]} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} visualLayers={defaultVisualLayers()} onVisualLayersChange={vi.fn()} resultPanel={<div>图像分类结果</div>} />)

    expect(screen.getByRole('main', { name: '训练画布' })).not.toHaveTextContent('图像分类结果')
    expect(screen.getByRole('main', { name: '训练画布' })).toHaveTextContent('已完成拟合')
    expect(screen.queryByLabelText('神经网络数据流')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '结果与解释' }))
    expect(screen.getByRole('region', { name: '模型解释与结果' })).toHaveTextContent('图像分类结果')
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

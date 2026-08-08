import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatasetStagePage, ModelStagePage, ResultsStagePage, StepLabPages, TrainingStagePage } from './StepLabPages'

afterEach(() => cleanup())

describe('分步实验室页面', () => {
  it('数据阶段复用数据集面板并展示阶段标题', () => {
    render(<DatasetStagePage onDatasetChange={vi.fn()} />)
    expect(screen.getAllByRole('heading', { name: '选择数据集' })).toHaveLength(2)
    expect(screen.getByLabelText('内置数据集')).toBeInTheDocument()
  })

  it('模型阶段可切换模型并编辑参数', async () => {
    const user = userEvent.setup()
    const onModelChange = vi.fn()
    render(<ModelStagePage model="knn" params={{ k: 5 }} onModelChange={onModelChange} onParamsChange={vi.fn()} />)
    await user.click(screen.getByRole('radio', { name: '逻辑回归' }))
    expect(onModelChange).toHaveBeenCalledWith('logistic-regression')
    expect(screen.getByRole('heading', { name: '选择模型与参数' })).toBeInTheDocument()
  })

  it('训练阶段显示状态、曲线并触发训练', async () => {
    const user = userEvent.setup()
    const onTrain = vi.fn()
    render(<TrainingStagePage status="等待训练" snapshots={[]} onTrain={onTrain} />)
    expect(screen.getByRole('img', { name: '训练损失曲线' })).toHaveTextContent('暂无训练过程数据')
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    expect(onTrain).toHaveBeenCalledTimes(1)
  })

  it('训练按钮位于训练面板底部', () => {
    const { container } = render(<TrainingStagePage status="等待训练" snapshots={[]} onTrain={vi.fn()} />)
    expect(container.querySelector('.training-panel .primary-button')).toBeInTheDocument()
  })

  it('结果阶段复用结果列表', () => {
    render(<ResultsStagePage records={[]} />)
    expect(screen.getByRole('heading', { name: '实验结果' })).toBeInTheDocument()
    expect(screen.getByText(/暂无训练记录/)).toBeInTheDocument()
  })

  it('容器只渲染当前阶段页面', () => {
    render(<StepLabPages activeStage="模型" onStageChange={vi.fn()} pages={{ 数据集: <p>数据内容</p>, 模型: <p>模型内容</p> }} />)
    expect(screen.getByText('模型内容')).toBeInTheDocument()
    expect(screen.queryByText('数据内容')).not.toBeInTheDocument()
  })
  it('shows current result on training page when training is complete', () => {
    const dataset = { name: 'test', features: [[0, 0], [1, 1]] as [number, number][], labels: ['a', 'b'] }
    render(<TrainingStagePage status="done" snapshots={[{ iteration: 1, loss: 0.1 }]} onTrain={vi.fn()} currentResult={{ dataset, predictions: ['a', 'b'], metrics: { accuracy: 1, precision: 1, recall: 1, f1: 1, labels: ['a', 'b'], confusionMatrix: [[1, 0], [0, 1]] }, predict: () => 'a' }} />)
    expect(screen.getByRole('heading', { name: '当前结果' })).toBeInTheDocument()
    expect(screen.getByText('准确率')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { workbenchStages, type ModelKind, type WorkbenchStage } from '../../app/workbenchTypes'
import { DatasetPage, ExperimentSetupPage, ModelPage, ResultsPage, TrainingPage, WorkbenchNavigation, WorkbenchStageView, type ExperimentRecord } from './pages'

afterEach(() => cleanup())

function ControlledExperimentSetup() {
  const [model, setModel] = useState<ModelKind>('knn')
  return <ExperimentSetupPage model={model} onModelChange={setModel} onDatasetChange={() => {}} />
}

describe('工作台子页面', () => {
  it('在合并准备页同时显示紧凑模型选择和数据预览', () => {
    render(<ExperimentSetupPage model="knn" onModelChange={vi.fn()} onDatasetChange={vi.fn()} onContinue={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '模型与数据' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('knn')
    expect(screen.getByRole('combobox', { name: '内置数据集' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '数据集预览' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'KNN' })).not.toBeInTheDocument()
    expect(screen.getByText('根据邻居投票进行分类。')).toBeInTheDocument()
  })

  it('合并准备页按模型限制数据类型，CNN 隐藏 CSV 上传', () => {
    render(<ExperimentSetupPage model="visual-cnn" onModelChange={vi.fn()} onDatasetChange={vi.fn()} />)

    expect(screen.getByRole('option', { name: '8×8 数字图像（0–9）' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '月牙形' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('上传 CSV')).not.toBeInTheDocument()
  })

  it('在合并准备页切换任务后请求该任务的首个模型', async () => {
    const user = userEvent.setup()
    const onModelChange = vi.fn()
    const { rerender } = render(<ExperimentSetupPage model="knn" onModelChange={onModelChange} onDatasetChange={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: '回归' }))
    expect(onModelChange).toHaveBeenCalledWith('linear-regression')

    rerender(<ExperimentSetupPage model="linear-regression" onModelChange={onModelChange} onDatasetChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('linear-regression')
  })

  it('准备页任务标签用左右方向键循环移动焦点并同步任务和首个模型', async () => {
    const user = userEvent.setup()
    render(<ControlledExperimentSetup />)
    const tabs = within(screen.getByRole('tablist', { name: '任务类型' })).getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1'])

    tabs[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: '回归' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: '回归' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('linear-regression')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: '聚类' })).toHaveFocus()
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('k-means')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: '回归' })).toHaveFocus()
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('linear-regression')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: '分类' })).toHaveFocus()
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('knn')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: '降维' })).toHaveFocus()
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('pca')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: '分类' })).toHaveFocus()
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('knn')
  })

  it('准备页任务标签支持 Home 和 End 聚焦并选择首末任务', async () => {
    const user = userEvent.setup()
    render(<ControlledExperimentSetup />)
    const tabs = within(screen.getByRole('tablist', { name: '任务类型' })).getAllByRole('tab')
    tabs[0].focus()

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: '降维' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: '降维' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('pca')

    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: '分类' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: '分类' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('knn')
  })

  it('准备页任务标签用键盘移动时跳过禁用项', async () => {
    const user = userEvent.setup()
    render(<ControlledExperimentSetup />)
    const tabs = within(screen.getByRole('tablist', { name: '任务类型' })).getAllByRole('tab')
    tabs[1].setAttribute('disabled', '')
    tabs[0].focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: '聚类' })).toHaveFocus()
    expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('k-means')
  })

  it('数据集页面显示选择和 CSV 上传入口', () => {
    render(<DatasetPage onDatasetChange={vi.fn()} onContinue={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '数据集' })).toBeInTheDocument()
    expect(screen.getByLabelText('内置数据集')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '8×8 数字图像（0–9）' })).toBeInTheDocument()
    expect(screen.getByLabelText('上传 CSV')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认数据集并进入实验流程' })).toBeInTheDocument()
  })

  it('CNN 数据集页只列出图像数据', () => {
    render(<DatasetPage model="visual-cnn" onDatasetChange={vi.fn()} />)
    expect(screen.getByRole('option', { name: '8×8 数字图像（0–9）' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '8×8 图形图像（5 类）' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '月牙形' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('上传 CSV')).not.toBeInTheDocument()
  })

  it('为数据集页提供受限宽度的布局入口', () => {
    render(<DatasetPage onDatasetChange={vi.fn()} />)

    expect(document.querySelector('.dataset-page')).toBeInTheDocument()
    expect(document.querySelector('.dataset-workspace')).toBeInTheDocument()
    expect(document.querySelector('.dataset-workspace > .page-heading')).toBeInTheDocument()
    expect(document.querySelector('.dataset-actions')).toBeInTheDocument()
  })

  it('模型页面支持选择三种模型并通知回调', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModelPage value="knn" onChange={onChange} />)
    expect(screen.getByRole('heading', { name: '模型' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '逻辑回归' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '线性 SVM' }))
    expect(onChange).toHaveBeenCalledWith('linear-svm')
  })

  it('训练页面显示状态并可触发训练', async () => {
    const user = userEvent.setup()
    const onTrain = vi.fn()
    render(<TrainingPage status="等待训练" onTrain={onTrain} />)
    expect(screen.getByRole('heading', { name: '训练' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /开始训练/ }))
    expect(onTrain).toHaveBeenCalledTimes(1)
  })

  it('点击整张实验记录卡即可切换详情', async () => {
    const record: ExperimentRecord = { id: '1', datasetName: '月牙形', model: 'KNN', timestamp: '2026-08-08 10:00', metrics: { accuracy: 0.9 } }
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<ResultsPage records={[record]} onSelect={onSelect} />)
    expect(screen.getByRole('heading', { name: '结果' })).toBeInTheDocument()
    expect(screen.getByText('月牙形')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /选择实验记录：月牙形 · KNN/ }))
    expect(onSelect).toHaveBeenCalledWith(record)
  })

  it('导航显示四个阶段并切换当前阶段', async () => {
    const user = userEvent.setup()
    const onStageChange = vi.fn()
    render(<WorkbenchNavigation activeStage={workbenchStages[0]} onStageChange={onStageChange} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    await user.click(tabs[2])
    expect(onStageChange).toHaveBeenCalledWith(workbenchStages[2])
  })

  it('阶段视图只渲染当前阶段并提供 tabpanel 语义', () => {
    const pages = Object.fromEntries(workbenchStages.map((stage, index) => [stage, <div key={stage}>{`stage-${index}`}</div>])) as Record<WorkbenchStage, React.ReactNode>
    render(<WorkbenchStageView activeStage={workbenchStages[3]} onStageChange={vi.fn()} pages={pages} />)
    expect(screen.getByRole('tabpanel')).toHaveTextContent('stage-3')
    expect(screen.queryByText('stage-0')).not.toBeInTheDocument()
  })

  it('模型页按任务类型分组并切换算法列表', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModelPage value="knn" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: '分类' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('radio', { name: 'KNN' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: '线性回归' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '回归' }))
    expect(screen.getByRole('radio', { name: '线性回归' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'KNN' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '线性回归' }))
    expect(onChange).toHaveBeenCalledWith('linear-regression')
  })

  it('模型页不展示与当前数据集不兼容的模型', () => {
    render(<ModelPage value="knn" onChange={vi.fn()} dataset={{ features: [Array(64).fill(0)], labels: [0], dataType: 'image', imageShape: { width: 8, height: 8, channels: 1 } }} />)
    expect(screen.queryByRole('radio', { name: 'KNN' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '可视化卷积神经网络' })).toBeInTheDocument()
  })
})

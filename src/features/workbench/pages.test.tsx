import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { workbenchStages, type WorkbenchStage } from '../../app/workbenchTypes'
import { DatasetPage, ModelPage, ResultsPage, TrainingPage, WorkbenchNavigation, WorkbenchStageView, type ExperimentRecord } from './pages'

afterEach(() => cleanup())

describe('工作台子页面', () => {
  it('数据集页面显示选择和 CSV 上传入口', () => {
    render(<DatasetPage onDatasetChange={vi.fn()} onContinue={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '数据集' })).toBeInTheDocument()
    expect(screen.getByLabelText('内置数据集')).toBeInTheDocument()
    expect(screen.getByLabelText('上传 CSV')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认数据集并进入实验流程' })).toBeInTheDocument()
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

  it('结果页面显示历史实验并可查看详情', async () => {
    const record: ExperimentRecord = { id: '1', datasetName: '月牙形', model: 'KNN', timestamp: '2026-08-08 10:00', metrics: { accuracy: 0.9 } }
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<ResultsPage records={[record]} onSelect={onSelect} />)
    expect(screen.getByRole('heading', { name: '结果' })).toBeInTheDocument()
    expect(screen.getByText('月牙形')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看详情' }))
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
})

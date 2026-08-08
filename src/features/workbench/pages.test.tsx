import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatasetPage, ModelPage, ResultsPage, TrainingPage, type ExperimentRecord } from './pages'

afterEach(() => cleanup())

describe('工作台子页面', () => {
  it('数据集页面显示数据集选择和 CSV 上传入口', () => {
    render(<DatasetPage onDatasetChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '数据集' })).toBeInTheDocument()
    expect(screen.getByLabelText('内置数据集')).toBeInTheDocument()
    expect(screen.getByLabelText('上传 CSV')).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    expect(onTrain).toHaveBeenCalledTimes(1)
  })

  it('结果页面展示历史实验记录和详情入口', async () => {
    const record: ExperimentRecord = { id: '1', datasetName: '月牙形', model: 'KNN', timestamp: '2026-08-08 10:00', metrics: { accuracy: 0.9 } }
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<ResultsPage records={[record]} onSelect={onSelect} />)
    expect(screen.getByRole('heading', { name: '结果' })).toBeInTheDocument()
    expect(screen.getByText('月牙形')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看详情' }))
    expect(onSelect).toHaveBeenCalledWith(record)
  })
})

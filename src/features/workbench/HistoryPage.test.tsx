import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExperimentRecord } from './pages'
import { HistoryPage, TopLevelNavigation } from './HistoryPage'

afterEach(() => cleanup())

describe('HistoryPage', () => {
  it('shows a helpful empty state when there are no saved experiments', () => {
    render(<HistoryPage records={[]} />)

    expect(screen.getByRole('heading', { name: '历史训练记录' })).toBeInTheDocument()
    expect(screen.getByText('暂无训练记录。完成一次训练后，记录会保存在这里。')).toBeInTheDocument()
  })

  it('renders saved experiments and forwards the detail action', async () => {
    const user = userEvent.setup()
    const record: ExperimentRecord = { id: 'experiment-1', datasetName: '月牙形', model: 'KNN', timestamp: '2026-08-08 10:00', metrics: { accuracy: 0.9 } }
    const onSelect = vi.fn()
    render(<HistoryPage records={[record]} selectedId={record.id} onSelect={onSelect} />)

    expect(screen.getByText('月牙形')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看详情' })).toHaveClass('is-selected')
    await user.click(screen.getByRole('button', { name: '查看详情' }))
    expect(onSelect).toHaveBeenCalledWith(record)
  })

  it('keeps the record list and detail panel visible in one workspace', () => {
    const record: ExperimentRecord = { id: 'experiment-1', datasetName: '月牙湾', model: 'KNN', timestamp: '2026-08-08 10:00', metrics: { accuracy: 0.9 } }
    render(<HistoryPage records={[record]} selectedDetail={<div>实验详情内容</div>} />)

    expect(screen.getByTestId('history-workspace')).toBeInTheDocument()
    expect(screen.getByTestId('history-list-panel')).toContainElement(screen.getByText('月牙湾'))
    expect(screen.getByTestId('history-detail-panel')).toContainElement(screen.getByText('实验详情内容'))
  })

  it('shows a detail hint when no record is selected', () => {
    render(<HistoryPage records={[]} />)

    expect(screen.getByTestId('history-detail-panel')).toHaveTextContent('选择一条记录查看详情')
  })
})

describe('TopLevelNavigation', () => {
  it('offers dataset, workflow and history tabs', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<TopLevelNavigation activePage="workflow" onPageChange={onPageChange} />)

    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { name: '数据集选择' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '实验流程' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: '历史记录' }))
    expect(onPageChange).toHaveBeenCalledWith('history')
  })
})

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
    render(<HistoryPage records={[record]} onSelect={onSelect} />)

    expect(screen.getByText('月牙形')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看详情' }))
    expect(onSelect).toHaveBeenCalledWith(record)
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

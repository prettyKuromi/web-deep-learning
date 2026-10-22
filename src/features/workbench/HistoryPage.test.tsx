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

  it('点击实验卡片即可切换详情', async () => {
    const user = userEvent.setup()
    const record: ExperimentRecord = { id: 'experiment-1', datasetName: '月牙形', model: 'KNN', timestamp: '2026-08-08 10:00', metrics: { accuracy: 0.9 } }
    const onSelect = vi.fn()
    render(<HistoryPage records={[record]} selectedId={record.id} onSelect={onSelect} />)

    expect(screen.getByText('月牙形')).toBeInTheDocument()
    const card = screen.getByRole('button', { name: /选择实验记录：月牙形 · KNN/ })
    expect(card.closest('.result-row')).toHaveClass('is-selected')
    expect(card).toHaveAttribute('aria-pressed', 'true')
    await user.click(card)
    expect(onSelect).toHaveBeenCalledWith(record)
  })

  it('删除操作针对被点击的记录卡片', async () => {
    const user = userEvent.setup()
    const records: ExperimentRecord[] = [
      { id: 'one', datasetName: '月牙形', model: 'KNN', timestamp: '2026-08-08 10:00', metrics: { accuracy: 0.9 } },
      { id: 'two', datasetName: '环形', model: 'KNN', timestamp: '2026-08-08 10:01', metrics: { accuracy: 0.8 } },
    ]
    const onDelete = vi.fn()
    render(<HistoryPage records={records} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: '删除月牙形记录' }))
    expect(onDelete).toHaveBeenCalledWith('one')
  })

  it('将 JSON 导入导出操作放在页面标题区域', () => {
    render(<HistoryPage records={[]} onImport={vi.fn()} onExport={vi.fn()} />)
    const heading = screen.getByRole('heading', { name: '历史训练记录' }).closest('.page-heading')
    expect(heading).toContainElement(screen.getByRole('button', { name: '导出 JSON' }))
    expect(heading).toContainElement(screen.getByText('导入 JSON'))
    expect(screen.queryByRole('button', { name: '删除当前' })).not.toBeInTheDocument()
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
  it('按模型、数据集、流程、历史的顺序提供主导航', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<TopLevelNavigation activePage="model" onPageChange={onPageChange} />)

    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['模型选择', '数据集选择', '实验流程', '历史记录'])
    expect(screen.getByRole('tab', { name: '模型选择' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '数据集选择' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '历史记录' }))
    expect(onPageChange).toHaveBeenCalledWith('history')
  })
})

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

  it('比较回归指标和分类指标来源、配置、样本规模与训练单位', async () => {
    const user = userEvent.setup()
    const classification: ExperimentRecord = {
      id: 'classification', datasetName: '月牙形', model: '逻辑回归', modelKind: 'logistic-regression', task: 'classification', timestamp: '2026-10-22',
      metrics: { accuracy: .9 }, sampleCount: 200, featureCount: 2, config: { iterations: 50, seed: 42 },
      evaluation: { config: { enabled: true, validationSplit: .2, seed: 42 }, trainSampleCount: 160, validationSampleCount: 40 },
      runMetadata: { status: 'completed', trainingUnit: 'iteration', evaluation: { source: '训练集/验证集划分', split: '20%' } },
      metricGroups: [{ source: '训练集', sampleCount: 160, metrics: [{ label: '准确率', value: .9 }] }, { source: '验证集', sampleCount: 40, metrics: [{ label: '准确率', value: .85 }] }],
    }
    const regression: ExperimentRecord = {
      id: 'regression', datasetName: '线性数据', model: '线性回归', modelKind: 'linear-regression', task: 'regression', timestamp: '2026-10-22', metrics: {},
      sampleCount: 100, featureCount: 3, config: { iterations: 75 },
      evaluation: { config: { enabled: true, validationSplit: .25, seed: 7 }, trainSampleCount: 75, validationSampleCount: 25 },
      runMetadata: { status: 'completed', trainingUnit: 'iteration', evaluation: { source: '训练集/验证集划分', split: '25%' } },
      metricGroups: [{ source: '训练集', sampleCount: 75, metrics: [{ label: 'MAE', value: .4 }, { label: 'MSE', value: .2 }, { label: 'R²', value: .8 }] }, { source: '验证集', sampleCount: 25, metrics: [{ label: 'MAE', value: .6 }, { label: 'MSE', value: .3 }, { label: 'R²', value: .7 }] }],
    }
    render(<HistoryPage records={[classification, regression]} />)
    await user.click(screen.getAllByRole('checkbox', { name: '比较' })[0])
    await user.click(screen.getAllByRole('checkbox', { name: '比较' })[1])

    const comparison = screen.getByTestId('history-comparison')
    expect(comparison).toHaveTextContent('回归')
    expect(comparison).toHaveTextContent('训练集 · MAE')
    expect(comparison).toHaveTextContent('验证集 · R²')
    expect(comparison).toHaveTextContent('训练/验证样本数')
    expect(comparison).toHaveTextContent('200 条 · 2 维')
    expect(comparison).toHaveTextContent('75 条 · 25 条')
    expect(comparison).toHaveTextContent('训练单位')
    expect(comparison).toHaveTextContent('参数')
    expect(comparison).toHaveTextContent('不适用')
    expect(comparison.textContent).not.toContain('0.000')
  })

  it('聚类和 PCA 比较只列出适用且已计算的指标', async () => {
    const user = userEvent.setup()
    const clustering: ExperimentRecord = {
      id: 'cluster', datasetName: '点云', model: 'DBSCAN', modelKind: 'dbscan', task: 'clustering', timestamp: '2026-10-22', metrics: {},
      sampleCount: 4, featureCount: 2, snapshots: [], metricGroups: [{ source: '全量数据', sampleCount: 4, metrics: [{ label: '簇数', value: 2 }, { label: '噪声样本数', value: 1 }] }],
    }
    const pca: ExperimentRecord = {
      id: 'pca', datasetName: '点云', model: 'PCA', modelKind: 'pca', task: 'dimensionality-reduction', timestamp: '2026-10-22', metrics: {},
      sampleCount: 4, featureCount: 2, snapshots: [], metricGroups: [{ source: '全量数据', sampleCount: 4, metrics: [{ label: '主成分 1 方差解释率', value: .7 }, { label: '累计方差解释率', value: .9 }] }],
    }
    render(<HistoryPage records={[clustering, pca]} />)
    await user.click(screen.getAllByRole('checkbox', { name: '比较' })[0])
    await user.click(screen.getAllByRole('checkbox', { name: '比较' })[1])

    const comparison = screen.getByTestId('history-comparison')
    expect(comparison).toHaveTextContent('全量数据 · 簇数')
    expect(comparison).toHaveTextContent('全量数据 · 主成分 1 方差解释率')
    expect(comparison).toHaveTextContent('不适用')
    expect(comparison.textContent).not.toContain('准确率')
    expect(comparison.textContent).not.toContain('MAE')
  })

  it('shows a detail hint when no record is selected', () => {
    render(<HistoryPage records={[]} />)

    expect(screen.getByTestId('history-detail-panel')).toHaveTextContent('选择一条记录查看详情')
  })
})

describe('TopLevelNavigation', () => {
  it('按准备、流程、历史的顺序提供主导航', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<TopLevelNavigation activePage="setup" onPageChange={onPageChange} />)

    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['模型与数据', '实验流程', '历史记录'])
    expect(screen.getByRole('tab', { name: '模型与数据' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: '历史记录' }))
    expect(onPageChange).toHaveBeenCalledWith('history')
  })
})

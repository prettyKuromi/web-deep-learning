import type { ReactNode } from 'react'
import { ResultsPage, type ExperimentRecord } from './pages'

export type TopLevelPage = 'workflow' | 'history'

export interface TopLevelNavigationProps {
  activePage: TopLevelPage
  onPageChange: (page: TopLevelPage) => void
}

export function TopLevelNavigation({ activePage, onPageChange }: TopLevelNavigationProps) {
  return <nav className="top-level-navigation" aria-label="主导航" role="tablist">
    <button type="button" role="tab" aria-selected={activePage === 'workflow'} className={activePage === 'workflow' ? 'active' : ''} onClick={() => onPageChange('workflow')}>实验流程</button>
    <button type="button" role="tab" aria-selected={activePage === 'history'} className={activePage === 'history' ? 'active' : ''} onClick={() => onPageChange('history')}>历史记录</button>
  </nav>
}

export interface HistoryPageProps {
  records: readonly ExperimentRecord[]
  onSelect?: (record: ExperimentRecord) => void
  selectedDetail?: ReactNode
}

export function HistoryPage({ records, onSelect, selectedDetail }: HistoryPageProps) {
  return <section className="history-page" aria-labelledby="history-page-title">
    <header className="page-heading">
      <p className="eyebrow">HISTORY / 01</p>
      <h2 id="history-page-title">历史训练记录</h2>
      <p>查看已保存的训练实验，回顾模型参数与评估结果。</p>
    </header>
    {records.length === 0
      ? <p className="empty-state">暂无训练记录。完成一次训练后，记录会保存在这里。</p>
      : <ResultsPage records={records} onSelect={onSelect} />}
    {selectedDetail}
  </section>
}

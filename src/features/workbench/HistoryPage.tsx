import type { ReactNode } from 'react'
import { ResultsPage, type ExperimentRecord } from './pages'

export type TopLevelPage = 'dataset' | 'workflow' | 'history'

export interface TopLevelNavigationProps {
  activePage: TopLevelPage
  onPageChange: (page: TopLevelPage) => void
  workflowDisabled?: boolean
  configurationDisabled?: boolean
  onImport?: (file: File) => void
  onExport?: () => void
  onDelete?: () => void
  importError?: string
}

export function TopLevelNavigation({ activePage, onPageChange, workflowDisabled = false, configurationDisabled = false }: TopLevelNavigationProps) {
  return <div className="top-level-navigation-wrap"><nav className="top-level-navigation" aria-label="主导航" role="tablist">
    <button type="button" role="tab" disabled={configurationDisabled} aria-selected={activePage === 'dataset'} className={activePage === 'dataset' ? 'active' : ''} onClick={() => onPageChange('dataset')}>数据集选择</button>
    <button type="button" role="tab" aria-selected={activePage === 'workflow'} disabled={workflowDisabled} title={workflowDisabled ? '请先确认数据集' : '配置模型并训练'} aria-describedby={workflowDisabled ? 'workflow-navigation-hint' : undefined} className={activePage === 'workflow' ? 'active' : ''} onClick={() => onPageChange('workflow')}>实验流程</button>
    <button type="button" role="tab" aria-selected={activePage === 'history'} className={activePage === 'history' ? 'active' : ''} onClick={() => onPageChange('history')}>历史记录</button>
  </nav>{workflowDisabled && <p className="navigation-hint" id="workflow-navigation-hint">请先确认数据集，再进入实验流程。</p>}</div>
}

export interface HistoryPageProps {
  onImport?: (file: File) => void
  onExport?: () => void
  onDelete?: () => void
  importError?: string
  records: readonly ExperimentRecord[]
  onSelect?: (record: ExperimentRecord) => void
  selectedDetail?: ReactNode
  selectedId?: string
}

export function HistoryPage({ records, onSelect, selectedDetail, selectedId, onImport, onExport, onDelete, importError }: HistoryPageProps) {
  return <section className="history-page" aria-labelledby="history-page-title">
    <header className="page-heading">
      <p className="eyebrow">实验回顾</p>
      <h2 id="history-page-title">历史训练记录</h2>
      <p>查看已保存的训练实验，回顾模型参数与评估结果。</p>
    </header>
    <div className="history-workspace" data-testid="history-workspace">
      <section className="history-list-panel" data-testid="history-list-panel" aria-label="训练记录列表">
        <div className="history-panel-heading">
          <div>
            <p className="eyebrow">已保存的实验</p>
            <h3>全部记录</h3>
          </div>
          <span className="history-count">{records.length} 条</span><div className="history-actions">{onExport && <button type="button" onClick={onExport} disabled={!records.length}>导出 JSON</button>}{onImport && <label><span className="visually-hidden">导入 JSON</span><input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = "" }} />导入 JSON</label>}{onDelete && <button type="button" onClick={onDelete} disabled={!selectedId}>删除当前</button>}</div>
        </div>
        {importError && <p role="alert" className="single-page-error">{importError}</p>}<div className="history-list-scroll">
          {records.length === 0 ? <p className="empty-state history-empty-list">暂无训练记录。完成一次训练后，记录会保存在这里。</p> : <ResultsPage records={records} onSelect={onSelect} selectedId={selectedId} />}
        </div>
      </section>
      <aside className="history-detail-panel" data-testid="history-detail-panel" aria-label="实验详情">
        {selectedDetail ?? <div className="history-detail-empty"><span className="history-detail-icon" aria-hidden="true">↗</span><strong>选择一条记录查看详情</strong><p>训练指标、混淆矩阵和决策边界会显示在这里。</p></div>}
      </aside>
    </div>
  </section>
}

import { useState, type ReactNode } from 'react'
import { ResultsPage, type ExperimentRecord } from './pages'

export type TopLevelPage = 'setup' | 'workflow' | 'history'

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
    <button type="button" role="tab" disabled={configurationDisabled} aria-selected={activePage === 'setup'} className={activePage === 'setup' ? 'active' : ''} onClick={() => onPageChange('setup')}>模型与数据</button>
    <button type="button" role="tab" aria-selected={activePage === 'workflow'} disabled={workflowDisabled} title={workflowDisabled ? '请先确认数据集' : '配置模型并训练'} aria-describedby={workflowDisabled ? 'workflow-navigation-hint' : undefined} className={activePage === 'workflow' ? 'active' : ''} onClick={() => onPageChange('workflow')}>实验流程</button>
    <button type="button" role="tab" aria-selected={activePage === 'history'} className={activePage === 'history' ? 'active' : ''} onClick={() => onPageChange('history')}>历史记录</button>
  </nav>{workflowDisabled && <p className="navigation-hint" id="workflow-navigation-hint">请先确认数据集，再进入实验流程。</p>}</div>
}

export interface HistoryPageProps {
  onImport?: (file: File) => void
  onExport?: () => void
  onDelete?: (recordId: string) => void
  importError?: string
  records: readonly ExperimentRecord[]
  onSelect?: (record: ExperimentRecord) => void
  selectedDetail?: ReactNode
  selectedId?: string
}

function metricValue(record: ExperimentRecord, key: string) {
  const value = record.metrics?.[key]
  return typeof value === 'number' ? value.toFixed(3) : '—'
}

function ComparisonPanel({ records, onRemove }: { records: readonly ExperimentRecord[]; onRemove: (id: string) => void }) {
  if (records.length < 2) return <p className="comparison-selection-hint" role="status">已选择 {records.length} 条，请再选择一条记录开始比较。</p>
  const curveComparable = records.every((record) => record.snapshots?.length && record.snapshots.every((snapshot) => typeof snapshot.loss === 'number'))
  const sameDataset = new Set(records.map((record) => record.runMetadata?.datasetFingerprint ?? record.datasetName)).size === 1
  const sameModel = new Set(records.map((record) => record.modelKind)).size === 1
  const showCurve = curveComparable && sameDataset && sameModel
  const losses = records.map((record) => record.snapshots!.map((snapshot) => snapshot.loss!))
  const allLosses = losses.flat()
  const minLoss = Math.min(...allLosses)
  const maxLoss = Math.max(...allLosses)
  const colors = ['#44d7a8', '#ffb85c', '#6eb8ff', '#ff718a']
  return <section className="history-comparison" aria-label="实验比较" data-testid="history-comparison">
    <header><div><p className="eyebrow">横向分析</p><h3>实验比较（{records.length}/4）</h3></div><span>{sameDataset ? '同一数据集' : '数据集不同，指标仅供参考'}</span></header>
    <div className="comparison-table-wrap"><table><thead><tr><th>字段</th>{records.map((record) => <th key={record.id}>{record.datasetName}<button type="button" aria-label={`移除${record.datasetName}`} onClick={() => onRemove(record.id)}>移除</button></th>)}</tr></thead><tbody>
      <tr><th>模型</th>{records.map((record) => <td key={record.id}>{record.modelKind}</td>)}</tr>
      <tr><th>准确率</th>{records.map((record) => <td key={record.id}>{metricValue(record, 'accuracy')}</td>)}</tr>
      <tr><th>F1</th>{records.map((record) => <td key={record.id}>{metricValue(record, 'f1')}</td>)}</tr>
      <tr><th>随机种子</th>{records.map((record) => <td key={record.id}>{record.runMetadata?.seed ?? '历史记录未保存'}</td>)}</tr>
      <tr><th>训练耗时</th>{records.map((record) => <td key={record.id}>{record.runMetadata?.durationMs == null ? '历史记录未保存' : `${(record.runMetadata.durationMs / 1000).toFixed(1)} 秒`}</td>)}</tr>
    </tbody></table></div>
    {showCurve ? <div className="comparison-chart"><h4>训练损失趋势</h4><svg viewBox="0 0 600 180" role="img" aria-label="同一模型与数据集下的训练损失趋势比较"><line x1="48" y1="12" x2="48" y2="145" /><line x1="48" y1="145" x2="588" y2="145" /><text x="8" y="18">损失</text><text x="280" y="174">训练快照序号</text>{losses.map((series, index) => { const points = series.map((loss, point) => `${48 + point / Math.max(1, series.length - 1) * 540},${135 - (loss - minLoss) / Math.max(.000001, maxLoss - minLoss) * 112}`).join(' '); return <polyline key={records[index].id} points={points} fill="none" stroke={colors[index]} strokeWidth="2" /> })}</svg><ul>{records.map((record, index) => <li key={record.id} style={{ color: colors[index] }}>{record.datasetName} · {record.modelKind}</li>)}</ul></div> : <p className="comparison-note">训练曲线：{!curveComparable ? '快照或损失值不完整，无法绘制。' : !sameDataset ? '数据集不同，不叠加损失曲线。' : '模型不同，损失定义可能不同，不叠加曲线。'}指标仍可并列查看，但请结合数据集和任务理解。</p>}
  </section>
}

export function HistoryPage({ records, onSelect, selectedDetail, selectedId, onImport, onExport, onDelete, importError }: HistoryPageProps) {
  const [comparisonIds, setComparisonIds] = useState<string[]>([])
  const comparisonRecords = records.filter((record) => comparisonIds.includes(record.id))
  const toggleComparison = (id: string) => setComparisonIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 4 ? current : [...current, id])
  return <section className="history-page" aria-labelledby="history-page-title">
    <header className="page-heading">
      <div className="page-heading-copy"><p className="eyebrow">实验回顾</p>
        <h2 id="history-page-title">历史训练记录</h2>
        <p>查看已保存的训练实验，回顾模型参数与评估结果。</p></div>
      <div className="history-actions" aria-label="历史记录操作">
        {onExport && <button type="button" onClick={onExport} disabled={!records.length}>导出 JSON</button>}
        {onImport && <label><span>导入 JSON</span><input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = '' }} /></label>}
      </div>
    </header>
    <div className="history-workspace" data-testid="history-workspace">
      <section className="history-list-panel" data-testid="history-list-panel" aria-label="训练记录列表">
        <div className="history-panel-heading">
          <div>
            <p className="eyebrow">已保存的实验</p>
            <h3>全部记录</h3>
          </div>
          <span className="history-count">{records.length} 条</span>
        </div>
        {importError && <p role="alert" className="single-page-error">{importError}</p>}<div className="history-list-scroll">
          {records.length === 0 ? <p className="empty-state history-empty-list">暂无训练记录。完成一次训练后，记录会保存在这里。</p> : <ResultsPage records={records} onSelect={onSelect} onDelete={onDelete} selectedId={selectedId} comparisonIds={comparisonIds} onToggleComparison={toggleComparison} />}
        </div>
      </section>
      <aside className="history-detail-panel" data-testid="history-detail-panel" aria-label="实验详情">
        {selectedDetail ?? <div className="history-detail-empty"><span className="history-detail-icon" aria-hidden="true">↗</span><strong>选择一条记录查看详情</strong><p>训练指标、混淆矩阵和决策边界会显示在这里。</p></div>}
        {comparisonIds.length > 0 && <ComparisonPanel records={comparisonRecords} onRemove={toggleComparison} />}
      </aside>
    </div>
  </section>
}

import type { ReactNode } from 'react'
import { DatasetPanel } from '../datasets/DatasetPanel'
import type { Dataset } from '../datasets/dataset'
import './pages.css'

export type ModelId = 'knn' | 'logistic-regression' | 'linear-svm'

export interface ExperimentRecord {
  id: string
  datasetName: string
  model: string
  timestamp: string
  metrics: { accuracy?: number; [key: string]: number | undefined }
}

export interface DatasetPageProps {
  onDatasetChange: (dataset: Dataset) => void
  onError?: (message: string) => void
}

export function DatasetPage({ onDatasetChange, onError }: DatasetPageProps) {
  return <PageShell eyebrow="DATASET / 01" title="数据集" description="选择内置数据集，或上传自己的二维分类 CSV 文件。"><DatasetPanel onDatasetChange={onDatasetChange} onError={onError} /></PageShell>
}

export interface ModelPageProps {
  value: ModelId
  onChange: (model: ModelId) => void
}

const models: Array<{ id: ModelId; name: string; description: string }> = [
  { id: 'knn', name: 'KNN', description: '根据邻居投票进行分类，适合直观理解决策边界。' },
  { id: 'logistic-regression', name: '逻辑回归', description: '学习线性概率边界，输出分类置信度。' },
  { id: 'linear-svm', name: '线性 SVM', description: '最大化分类间隔，适合线性可分数据。' },
]

export function ModelPage({ value, onChange }: ModelPageProps) {
  return <PageShell eyebrow="MODEL / 02" title="模型" description="选择要训练的分类算法，并查看其核心思路。">
    <div className="workbench-page-card model-options" role="radiogroup" aria-label="模型类型">
      {models.map((model) => <label className={`model-option ${value === model.id ? 'selected' : ''}`} key={model.id}>
        <input aria-label={model.name} type="radio" name="model" value={model.id} checked={value === model.id} onChange={() => onChange(model.id)} />
        <span><strong>{model.name}</strong><small>{model.description}</small></span>
      </label>)}
    </div>
  </PageShell>
}

export interface TrainingPageProps {
  status: string
  onTrain: () => void
  disabled?: boolean
  children?: ReactNode
}

export function TrainingPage({ status, onTrain, disabled, children }: TrainingPageProps) {
  return <PageShell eyebrow="TRAINING / 03" title="训练" description="设置参数并启动训练。训练状态和进度会实时显示。">
    <div className="workbench-page-card training-panel">
      <div className="training-status-large" role="status">{status}</div>
      {children}
      <button className="primary-button" type="button" onClick={onTrain} disabled={disabled}>开始训练 <span aria-hidden="true">→</span></button>
    </div>
  </PageShell>
}

export interface ResultsPageProps {
  records: readonly ExperimentRecord[]
  onSelect?: (record: ExperimentRecord) => void
}

export function ResultsPage({ records, onSelect }: ResultsPageProps) {
  return <PageShell eyebrow="RESULTS / 04" title="结果" description="查看此前实验的指标、参数和训练时间，随时回看结果。">
    <div className="workbench-page-card results-panel">
      {records.length === 0 ? <p className="empty-state">暂无训练记录。完成一次训练后，结果会显示在这里。</p> : <div className="results-list">{records.map((record) => <article className="result-row" key={record.id}>
        <div><strong>{record.datasetName}</strong><span>{record.model} · {record.timestamp}</span></div>
        <div className="result-metric">准确率 {record.metrics.accuracy == null ? '—' : `${(record.metrics.accuracy * 100).toFixed(1)}%`}</div>
        {onSelect && <button type="button" onClick={() => onSelect(record)}>查看详情</button>}
      </article>)}</div>}
    </div>
  </PageShell>
}

function PageShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <section className="workbench-page" aria-labelledby={`page-${title}`}>
    <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h2 id={`page-${title}`}>{title}</h2><p>{description}</p></header>
    {children}
  </section>
}

import { useState, type ReactNode } from 'react'
import { DatasetPanel, type DatasetImportState } from '../datasets/DatasetPanel'
import type { Dataset } from '../datasets/dataset'
import { isModelCompatible, modelGroups, modelTask, taskLabels, workbenchStages, type ModelKind, type TaskKind, type WorkbenchStage } from '../../app/workbenchTypes'
import './pages.css'

export type ModelId = ModelKind

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
  onContinue?: () => void
  initialDataset?: Dataset
  onValidityChange?: (valid: boolean) => void
  importState?: DatasetImportState
  onImportStateChange?: (state: DatasetImportState) => void
}

export function DatasetPage({ onDatasetChange, onError, onContinue, initialDataset, onValidityChange, importState, onImportStateChange }: DatasetPageProps) {
  return <section className="workbench-page dataset-page" aria-labelledby="page-数据集"><div className="dataset-workspace"><header className="page-heading"><p className="eyebrow">数据准备 / 01</p><h2 id="page-数据集">数据集</h2><p>选择内置数据集，或上传自己的多维数值特征 CSV 文件。</p></header><DatasetPanel initialDataset={initialDataset} importState={importState} onImportStateChange={onImportStateChange} onValidityChange={onValidityChange} onDatasetChange={onDatasetChange} onError={onError} action={(valid) => <button className="primary-button dataset-continue" type="button" disabled={!valid} onClick={onContinue}>确认数据集并进入实验流程 <span aria-hidden="true">→</span></button>} /></div></section>
}

export interface ModelPageProps {
  value: ModelId
  onChange: (model: ModelId) => void
  dataset?: Dataset
}

const modelInfo: Record<ModelKind, { name: string; description: string }> = {
  knn: { name: 'KNN', description: '根据邻居投票进行分类。' },
  'logistic-regression': { name: '逻辑回归', description: '学习线性概率边界。' },
  'linear-svm': { name: '线性 SVM', description: '最大化分类间隔。' },
  perceptron: { name: '感知机', description: '经典线性二分类算法。' },
  'decision-tree': { name: '决策树', description: '按特征阈值递归划分数据。' },
  'random-forest': { name: '随机森林', description: '多棵树投票的集成算法。' },
  adaboost: { name: 'AdaBoost', description: '逐轮强化弱分类器。' },
  'naive-bayes': { name: '朴素贝叶斯', description: '基于概率和特征独立假设。' },
  'linear-regression': { name: '线性回归', description: '拟合连续数值。' },
  'ridge-regression': { name: '岭回归', description: '带 L2 正则化。' },
  'k-means': { name: 'K-Means', description: '迭代寻找簇中心。' },
  dbscan: { name: 'DBSCAN', description: '基于密度发现簇与噪声。' },
  pca: { name: 'PCA', description: '提取主成分降维。' },
  mlp: { name: '多层感知机（MLP）', description: '通过多层神经网络学习非线性关系。' },
  'visual-cnn': { name: '可视化卷积神经网络', description: '面向 8×8 灰度图像的可搭建卷积网络。' },
}

export function ModelPage({ value, onChange, dataset }: ModelPageProps) {
  const [task, setTask] = useState<TaskKind>(modelTask[value])
  return <PageShell eyebrow="选择模型 / 02" title="模型" description="选择要训练的算法，并查看其适用范围。">
    <div className="task-tabs" role="tablist" aria-label="任务类型">{(Object.keys(taskLabels) as TaskKind[]).map((kind) => <button key={kind} type="button" role="tab" aria-selected={task === kind} className={task === kind ? 'active' : ''} onClick={() => setTask(kind)}>{taskLabels[kind]}</button>)}</div>
    {value === 'mlp' && <p className="model-suitability-notice">适用提醒：MLP 适合数值特征和较复杂的非线性关系；样本过少、类别极不平衡或特征尺度差异很大时，结果可能不稳定。请先进行标准化，并结合验证集指标判断模型是否过拟合。</p>}
    <div className="workbench-page-card model-options" role="radiogroup" aria-label="模型类型">
      {modelGroups[task].map((id) => { const compatibility = dataset ? isModelCompatible(id, dataset) : { compatible: true }; return <label className={`model-option ${value === id ? 'selected' : ''}`} key={id}>
        <input aria-label={modelInfo[id].name} type="radio" name="model" value={id} checked={value === id} disabled={!compatibility.compatible} onChange={() => onChange(id)} />
        <span><strong>{modelInfo[id].name}</strong><small>{modelInfo[id].description}{compatibility.compatible ? '' : `（${compatibility.reason}）`}</small></span>
      </label> })}
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
  return <PageShell eyebrow="开始训练 / 03" title="训练" description="设置参数并启动训练。训练状态和进度会实时显示。">
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
  selectedId?: string
}

export function ResultsPage({ records, onSelect, selectedId }: ResultsPageProps) {
  return <PageShell eyebrow="实验结果 / 04" title="结果" description="查看此前实验的指标、参数和训练时间，随时回看结果。">
    <div className="workbench-page-card results-panel">
      {records.length === 0 ? <p className="empty-state">暂无训练记录。完成一次训练后，结果会显示在这里。</p> : <div className="results-list">{records.map((record) => <article className={`result-row${selectedId === record.id ? ' is-selected' : ''}`} key={record.id}>
        <div><strong>{record.datasetName}</strong><span>{record.model} · {record.timestamp}</span></div>
        <div className="result-metric">准确率 {record.metrics.accuracy == null ? '—' : `${(record.metrics.accuracy * 100).toFixed(1)}%`}</div>
        {onSelect && <button className={selectedId === record.id ? 'is-selected' : ''} aria-pressed={selectedId === record.id} type="button" onClick={() => onSelect(record)}>{selectedId === record.id ? '当前查看' : '查看详情'}</button>}
      </article>)}</div>}
    </div>
  </PageShell>
}

function PageShell({ eyebrow, title, description, className = '', children }: { eyebrow: string; title: string; description: string; className?: string; children: ReactNode }) {
  return <section className={`workbench-page ${className}`.trim()} aria-labelledby={`page-${title}`}>
    <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h2 id={`page-${title}`}>{title}</h2><p>{description}</p></header>
    {children}
  </section>
}

export interface WorkbenchNavigationProps {
  activeStage: WorkbenchStage
  onStageChange: (stage: WorkbenchStage) => void
  stages?: readonly WorkbenchStage[]
}

export function WorkbenchNavigation({ activeStage, onStageChange, stages = workbenchStages }: WorkbenchNavigationProps) {
  return <nav className="workbench-navigation" aria-label="工作台阶段">
    {stages.map((stage, index) => <button key={stage} type="button" role="tab" aria-selected={activeStage === stage} aria-controls={`stage-panel-${index}`} className={activeStage === stage ? 'active' : ''} onClick={() => onStageChange(stage)}>{`${String(index + 1).padStart(2, '0')} ${stage}`}</button>)}
  </nav>
}

export interface WorkbenchStageViewProps {
  activeStage: WorkbenchStage
  onStageChange: (stage: WorkbenchStage) => void
  pages: Partial<Record<WorkbenchStage, ReactNode>>
}

export function WorkbenchStageView({ activeStage, onStageChange, pages }: WorkbenchStageViewProps) {
  const index = workbenchStages.indexOf(activeStage)
  return <div className="workbench-stage-view">
    <WorkbenchNavigation activeStage={activeStage} onStageChange={onStageChange} />
    <section id={`stage-panel-${index}`} role="tabpanel" aria-label={activeStage} className="workbench-stage-panel">{pages[activeStage]}</section>
  </div>
}

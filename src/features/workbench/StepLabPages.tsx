import type { ReactNode } from 'react'
import { DatasetPanel } from '../datasets/DatasetPanel'
import type { Dataset } from '../datasets/dataset'
import { ModelParameterPanel } from '../training/ModelParameterPanel'
import type { TrainSnapshot } from '../training/types'
import { TrainingProgressChart } from '../training/TrainingProgressChart'
import { ResultsPage, type ExperimentRecord } from './pages'
import { CurrentResultPanel, type CurrentResult } from './CurrentResultPanel'
import type { ModelKind, WorkbenchStage } from '../../app/workbenchTypes'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM' }
const modelDescriptions: Record<ModelKind, string> = {
  knn: '根据邻居投票进行分类，直观展示决策边界。',
  'logistic-regression': '学习线性概率边界，输出分类置信度。',
  'linear-svm': '最大化分类间隔，适合线性可分数据。',
}

function StageHeader({ step, title, description }: { step: string; title: string; description: string }) {
  return <header className="page-heading"><p className="eyebrow">{step}</p><h2>{title}</h2><p>{description}</p></header>
}

export interface DatasetStagePageProps { onDatasetChange: (dataset: Dataset) => void; onError?: (message: string) => void }
export function DatasetStagePage({ onDatasetChange, onError }: DatasetStagePageProps) {
  return <section className="workbench-page" aria-labelledby="dataset-stage-title"><StageHeader step="DATASET / 01" title="选择数据集" description="选择内置数据集，或上传自己的二维分类 CSV 文件。" /><DatasetPanel onDatasetChange={onDatasetChange} onError={onError} /></section>
}

export interface ModelStagePageProps { model: ModelKind; params: Record<string, number>; onModelChange: (model: ModelKind) => void; onParamsChange: (params: Record<string, number>) => void }
export function ModelStagePage({ model, params, onModelChange, onParamsChange }: ModelStagePageProps) {
  return <section className="workbench-page" aria-labelledby="model-stage-title"><StageHeader step="MODEL / 02" title="选择模型与参数" description="选择分类算法，并根据实验目标调整参数。" /><div className="workbench-page-card model-options" role="radiogroup" aria-label="模型类型">{(Object.keys(modelNames) as ModelKind[]).map((kind) => <label className={`model-option ${model === kind ? 'selected' : ''}`} key={kind}><input aria-label={modelNames[kind]} type="radio" name="step-lab-model" value={kind} checked={model === kind} onChange={() => onModelChange(kind)} /><span><strong>{modelNames[kind]}</strong><small>{modelDescriptions[kind]}</small></span></label>)}</div><ModelParameterPanel model={model} value={params} onChange={onParamsChange} /></section>
}

export interface TrainingStagePageProps { status: string; snapshots: readonly TrainSnapshot[]; onTrain: () => void; disabled?: boolean; currentResult?: CurrentResult }
export function TrainingStagePage({ status, snapshots, onTrain, disabled, currentResult }: TrainingStagePageProps) {
  return <section className="workbench-page" aria-labelledby="training-stage-title"><StageHeader step="TRAINING / 03" title="训练模型" description="启动训练并观察损失曲线；训练完成后可在当前页面查看结果。" /><div className="workbench-page-card training-panel"><div className="training-status-large" role="status">{status}</div><div className="chart-frame progress-chart"><TrainingProgressChart snapshots={snapshots} /></div><div className="training-panel-actions"><button className="primary-button" type="button" onClick={onTrain} disabled={disabled}>{disabled ? '训练中…' : '开始训练'} <span aria-hidden="true">→</span></button></div></div>{currentResult && <CurrentResultPanel result={currentResult} />}</section>
}

export interface ResultsStagePageProps { records: readonly ExperimentRecord[]; onSelect?: (record: ExperimentRecord) => void; selectedDetail?: ReactNode }
export function ResultsStagePage({ records, onSelect, selectedDetail }: ResultsStagePageProps) {
  return <section className="workbench-page" aria-labelledby="results-stage-title"><StageHeader step="RESULTS / 04" title="实验结果" description="查看历史实验记录与评估结果。" /><ResultsPage records={records} onSelect={onSelect} />{selectedDetail}</section>
}

export interface StepLabPagesProps { activeStage: WorkbenchStage; onStageChange?: (stage: WorkbenchStage) => void; pages: Partial<Record<WorkbenchStage, ReactNode>> }
export function StepLabPages({ activeStage, pages }: StepLabPagesProps) {
  return <section className="step-lab-pages" role="tabpanel" aria-label={activeStage}>{pages[activeStage] ?? <p className="empty-state">当前阶段暂无内容</p>}</section>
}

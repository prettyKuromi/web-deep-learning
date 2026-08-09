import { useState, type ReactNode } from 'react'
import { DatasetPanel } from '../datasets/DatasetPanel'
import type { Dataset } from '../datasets/dataset'
import { ModelParameterPanel } from '../training/ModelParameterPanel'
import type { TrainSnapshot, PcaModel } from '../training/types'
import { TrainingProgressChart } from '../training/TrainingProgressChart'
import { ResultsPage, type ExperimentRecord } from './pages'
import { CurrentResultPanel, type CurrentResult } from './CurrentResultPanel'
import { PcaResultPanel } from './UnsupervisedResultPanel'
import { modelGroups, modelTask, taskLabels, type ModelKind, type TaskKind, type WorkbenchStage } from '../../app/workbenchTypes'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机', 'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA' }
const modelDescriptions: Record<ModelKind, string> = { knn: '根据邻居投票进行分类，直观展示决策边界。', 'logistic-regression': '学习线性概率边界，输出分类置信度。', 'linear-svm': '最大化分类间隔，适合线性可分数据。', perceptron: '经典线性二分类算法。', 'decision-tree': '通过特征阈值递归划分数据。', 'random-forest': '多棵决策树投票的集成方法。', adaboost: '逐轮组合弱分类器。', 'naive-bayes': '基于概率和特征独立假设分类。', 'linear-regression': '拟合连续数值的线性关系。', 'ridge-regression': '带 L2 正则化的线性回归。', 'k-means': '迭代寻找簇中心进行聚类。', dbscan: '按密度发现簇并识别噪声点。', pca: '提取主要成分并降低维度。' }

function StageHeader({ step, title, description }: { step: string; title: string; description: string }) { return <header className="page-heading"><p className="eyebrow">{step}</p><h2>{title}</h2><p>{description}</p></header> }
export interface DatasetStagePageProps { onDatasetChange: (dataset: Dataset) => void; onError?: (message: string) => void }
export function DatasetStagePage({ onDatasetChange, onError }: DatasetStagePageProps) { return <section className="workbench-page" aria-labelledby="dataset-stage-title"><StageHeader step="DATASET / 01" title="选择数据集" description="选择内置数据集，或上传自己的二维分类 CSV 文件。" /><DatasetPanel onDatasetChange={onDatasetChange} onError={onError} /></section> }

export interface ModelStagePageProps { model?: ModelKind; params: Record<string, number>; onModelChange: (model: ModelKind) => void; onParamsChange: (params: Record<string, number>) => void }
export function ModelStagePage({ model, params, onModelChange, onParamsChange }: ModelStagePageProps) {
  const [task, setTask] = useState<TaskKind>(model ? modelTask[model] : 'classification')
  const models = modelGroups[task]
  return <section className="workbench-page"><StageHeader step="MODEL / 02" title="选择模型与参数" description="先选择任务类型，再选择算法并调整参数。" /><div className="task-tabs" role="tablist" aria-label="任务类型">{(Object.keys(taskLabels) as TaskKind[]).map((kind) => <button key={kind} type="button" role="tab" aria-selected={task === kind} className={task === kind ? 'active' : ''} onClick={() => setTask(kind)}>{taskLabels[kind]}</button>)}</div><div className="workbench-page-card model-options" role="radiogroup" aria-label="模型类型">{models.map((kind) => <label className={`model-option ${model === kind ? 'selected' : ''}`} key={kind}><input aria-label={modelNames[kind]} type="radio" name="step-lab-model" value={kind} checked={model === kind} onChange={() => onModelChange(kind)} /><span><strong>{modelNames[kind]}</strong><small>{modelDescriptions[kind]}</small></span></label>)}</div>{model ? <ModelParameterPanel model={model} value={params} onChange={onParamsChange} /> : <p className="empty-state">请先选择模型</p>}</section>
}

export interface TrainingStagePageProps { status: string; snapshots: readonly TrainSnapshot[]; onTrain: () => void; disabled?: boolean; currentResult?: CurrentResult; pcaResult?: { model: PcaModel; projections: readonly (readonly number[])[] } }
export function TrainingStagePage({ status, snapshots, onTrain, disabled, currentResult, pcaResult }: TrainingStagePageProps) { return <section className="workbench-page" aria-labelledby="training-stage-title"><StageHeader step="TRAINING / 03" title="训练模型" description="启动训练并观察损失曲线；训练完成后可在当前页面查看结果。" /><div className="workbench-page-card training-panel"><div className="training-status-large" role="status">{status}</div><div className="chart-frame progress-chart"><TrainingProgressChart snapshots={snapshots} /></div><div className="training-panel-actions"><button className="primary-button" type="button" onClick={onTrain} disabled={disabled}>{disabled ? '训练中…' : '开始训练'} <span aria-hidden="true">→</span></button></div></div>{currentResult && <CurrentResultPanel result={currentResult} />}{pcaResult && <PcaResultPanel {...pcaResult} />}</section> }
export interface ResultsStagePageProps { records: readonly ExperimentRecord[]; onSelect?: (record: ExperimentRecord) => void; selectedDetail?: ReactNode }
export function ResultsStagePage({ records, onSelect, selectedDetail }: ResultsStagePageProps) { return <section className="workbench-page" aria-labelledby="results-stage-title"><StageHeader step="RESULTS / 04" title="实验结果" description="查看历史实验记录与评估结果。" /><ResultsPage records={records} onSelect={onSelect} />{selectedDetail}</section> }
export interface StepLabPagesProps { activeStage: WorkbenchStage; onStageChange?: (stage: WorkbenchStage) => void; pages: Partial<Record<WorkbenchStage, ReactNode>> }
export function StepLabPages({ activeStage, pages }: StepLabPagesProps) { return <section className="step-lab-pages" role="tabpanel" aria-label={activeStage}>{pages[activeStage] ?? <p className="empty-state">当前阶段暂无内容</p>}</section> }

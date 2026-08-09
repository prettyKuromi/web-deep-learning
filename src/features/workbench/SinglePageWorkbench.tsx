import { useState, type ReactNode } from 'react'
import type { Dataset } from '../datasets/dataset'
import { DatasetPanel } from '../datasets/DatasetPanel'
import { ModelParameterPanel } from '../training/ModelParameterPanel'
import { TrainingProgressChart } from '../training/TrainingProgressChart'
import type { TrainSnapshot } from '../training/types'
import type { ModelKind } from '../../app/workbenchTypes'
import { CurrentResultPanel, type CurrentResult } from './CurrentResultPanel'
import './SinglePageWorkbench.css'
import './SinglePageWorkbench.layout.css'

const modelNames: Record<ModelKind, string> = {
  knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机',
  'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯',
  mlp: '多层感知机（MLP）', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA',
}

export interface SinglePageWorkbenchProps {
  model?: ModelKind
  params: Record<string, number>
  status: string
  snapshots: readonly TrainSnapshot[]
  onDatasetChange: (dataset: Dataset) => void
  onDatasetError?: (message: string) => void
  onModelChange: (model: ModelKind) => void
  onParamsChange: (params: Record<string, number>) => void
  onStartTraining: () => void
  onPauseTraining?: () => void
  onStepTraining?: () => void
  onResumeTraining?: () => void
  onStopTraining?: () => void
  onResetTraining?: () => void
  currentResult?: CurrentResult
  explanation?: ReactNode
  error?: string
}

export function SinglePageWorkbench({
  model, params, status, snapshots, onDatasetChange, onDatasetError, onModelChange, onParamsChange,
  onStartTraining, onPauseTraining, onStepTraining, onResumeTraining, onStopTraining, onResetTraining,
  currentResult, explanation, error,
}: SinglePageWorkbenchProps) {
  const [startError, setStartError] = useState('')
  const isRunning = status === '训练中…'
  const hasTraining = snapshots.length > 0 || isRunning
  const handleStart = () => {
    if (!model) { setStartError('请先选择模型'); return }
    setStartError('')
    onStartTraining()
  }
  return (
    <div className="single-page-workbench single-page-workbench--four-columns">
      <aside className="single-page-column single-page-dataset" aria-label="数据集">
        <header className="single-page-heading"><p className="eyebrow">DATASET</p><h2>数据集与预览</h2><p>选择数据并检查样本分布。</p></header>
        <DatasetPanel onDatasetChange={onDatasetChange} onError={onDatasetError} />
      </aside>
      <aside className="single-page-column single-page-config" aria-label="实验配置">
        <header className="single-page-heading"><p className="eyebrow">CONFIGURATION</p><h2>实验配置</h2><p>选择数据集、模型和训练参数。</p></header>
        <DatasetPanel onDatasetChange={onDatasetChange} onError={onDatasetError} />
        <section className="single-page-card" aria-label="模型选择与参数">
          <h3>模型与参数</h3>
          <label className="single-page-label">训练模型<select aria-label="训练模型" value={model ?? ''} onChange={(event) => event.target.value && onModelChange(event.target.value as ModelKind)}><option value="">请选择模型</option>{(Object.keys(modelNames) as ModelKind[]).map((kind) => <option key={kind} value={kind}>{modelNames[kind]}</option>)}</select></label>
          {model ? <ModelParameterPanel model={model} value={params} onChange={onParamsChange} /> : <p className="single-page-hint">请选择模型后配置参数。</p>}
        </section>
      </aside>

      <main className="single-page-column single-page-canvas" aria-label="训练画布">
        <header className="single-page-heading"><p className="eyebrow">TRAINING / LIVE</p><h2>训练过程</h2><p>实时观察损失曲线与训练状态。</p></header>
        <section className="single-page-card training-canvas-card">
          <div className="single-page-status" role="status">{status}</div>
          <div className="single-page-chart"><TrainingProgressChart snapshots={snapshots} /></div>
          <div className="single-page-controls" aria-label="训练控制">
            <button type="button" className="primary-button" onClick={handleStart}>开始训练</button>
            <button type="button" onClick={onPauseTraining} disabled={!isRunning}>暂停</button>
            <button type="button" onClick={onStepTraining} disabled={!hasTraining}>单步</button>
            <button type="button" onClick={onResumeTraining} disabled={isRunning || !hasTraining}>继续</button>
            <button type="button" onClick={onStopTraining} disabled={!hasTraining}>停止</button>
            <button type="button" onClick={onResetTraining} disabled={!hasTraining}>重置</button>
          </div>
          {startError && <p role="alert" className="single-page-error">{startError}</p>}
          {error && <p role="alert" className="single-page-error">{error}</p>}
        </section>
        {snapshots.length > 0 && <section className="single-page-card"><h3>训练时间线</h3><ol className="single-page-timeline">{snapshots.slice(-8).map((snapshot) => <li key={`${snapshot.iteration}-${snapshot.timestamp}`}>第 {snapshot.iteration} 次迭代{snapshot.loss != null ? ` · 损失 ${snapshot.loss.toFixed(4)}` : ''}</li>)}</ol></section>}
      </main>

      <aside className="single-page-column single-page-explanation" aria-label="模型解释与结果">
        <header className="single-page-heading"><p className="eyebrow">MODEL / INSIGHT</p><h2>模型解释与结果</h2><p>理解模型如何做出预测。</p></header>
        <section className="single-page-card model-explanation-card"><h3>{model ? modelNames[model] : '尚未选择模型'}</h3>{explanation ?? <p className="single-page-hint">训练后将展示模型结构、关键参数和决策过程。</p>}</section>
        {currentResult && <CurrentResultPanel result={currentResult} />}
      </aside>
    </div>
  )
}

import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Dataset } from '../datasets/dataset'
import { isModelCompatible } from '../../app/workbenchTypes'
import { ModelParameterPanel } from '../training/ModelParameterPanel'
import { TrainingProgressChart } from '../training/TrainingProgressChart'
import type { TrainSnapshot, TrainingCapability } from '../training/types'
import { getTrainingCapability, trainingUnitLabel } from '../training/trainingCapabilities'
import type { EvaluationConfig } from '../training/evaluation'
import { modelGroups, modelTask, taskLabels, type ModelKind, type TaskKind } from '../../app/workbenchTypes'
import { CurrentResultPanel, type CurrentResult } from './CurrentResultPanel'
import { NetworkFlowCanvas } from '../training/NetworkFlowCanvas'
import type { VisualLayer } from '../training/visualNetwork'
import { describeVisualNetwork } from '../training/visualNetwork'
import './SinglePageWorkbench.css'
import './SinglePageWorkbench.layout.css'

const modelNames: Partial<Record<ModelKind, string>> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机', 'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', mlp: '多层感知机（MLP）', 'visual-cnn': '可视化卷积神经网络', lstm: 'LSTM', transformer: 'Transformer', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA' }
const modelName = (kind?: ModelKind) => kind ? modelNames[kind] ?? '未命名模型' : '尚未选择模型'
type CanvasView = 'training' | 'results' | 'architecture'

export interface SinglePageWorkbenchProps {
  parametersValid?: boolean; onParamsValidityChange?: (valid: boolean) => void;
  model?: ModelKind; params: Record<string, number>; status: string; snapshots: readonly TrainSnapshot[]
  capability?: TrainingCapability
  evaluationConfig?: EvaluationConfig
  onEvaluationConfigChange?: (config: EvaluationConfig) => void
  dataset?: Dataset; visualLayers?: VisualLayer[]; onVisualLayersChange?: (layers: VisualLayer[]) => void
  onDatasetChange: (dataset: Dataset) => void; datasetName?: string; onChangeDataset?: () => void
  onDatasetError?: (message: string) => void; onModelChange: (model: ModelKind) => void
  onParamsChange: (params: Record<string, number>) => void; onStartTraining: () => void
  onPauseTraining?: () => void; onStepTraining?: () => void; onResumeTraining?: () => void
  onStopTraining?: () => void; onResetTraining?: () => void; currentResult?: CurrentResult
  resultPanel?: ReactNode;
  explanation?: ReactNode; error?: string
}

export function SinglePageWorkbench({ parametersValid = true, onParamsValidityChange, model, params, status, snapshots, dataset, visualLayers, onVisualLayersChange, datasetName, onChangeDataset, onModelChange, onParamsChange, onStartTraining, onPauseTraining, onStepTraining, onResumeTraining, onStopTraining, onResetTraining, currentResult, resultPanel, explanation, error, capability, evaluationConfig = { enabled: false, validationSplit: .2, seed: 42 }, onEvaluationConfigChange }: SinglePageWorkbenchProps) {
  const activeDataset = dataset ?? { features: [], labels: [], dataType: 'tabular' as const }
  const activeVisualLayers = visualLayers ?? []
  const isVisualCnn = model === 'visual-cnn' && Boolean(activeDataset.imageShape)
  const visualNetworkValid = model !== 'visual-cnn' || Boolean(activeDataset.imageShape && describeVisualNetwork(activeVisualLayers, activeDataset.imageShape, new Set(activeDataset.labels).size).valid)
  const [task, setTask] = useState<TaskKind>(model ? modelTask[model] : 'classification')
  const [canvasView, setCanvasView] = useState<CanvasView>('training')
  const isRunning = status === '训练中…'
  const isPaused = status === '训练已暂停'
  const isPreparing = status === '准备训练' || status === '初始化模型'
  const lastSnapshot = snapshots.at(-1)
  const effectiveCapability = capability ?? (model ? getTrainingCapability(model, params) : undefined)
  const totalIterations = effectiveCapability?.total
  const currentIteration = lastSnapshot?.iteration ?? 0
  const percent = totalIterations ? Math.min(100, currentIteration / totalIterations * 100) : 0
  const isActive = isPreparing || isRunning || isPaused
  const controllable = Boolean(effectiveCapability?.canPause)
  const hasTraining = snapshots.length > 0 || isActive || ['训练完成', '训练完成，保存失败', '训练已停止', '训练已取消', '训练失败'].includes(status)
  const availableTasks = (Object.keys(taskLabels) as TaskKind[]).filter((kind) => modelGroups[kind].some((candidate) => isModelCompatible(candidate, activeDataset).compatible))
  const availableModels = modelGroups[task].filter((candidate) => isModelCompatible(candidate, activeDataset).compatible)
  const chooseTask = (nextTask: TaskKind) => {
    const nextModel = modelGroups[nextTask].find((candidate) => isModelCompatible(candidate, activeDataset).compatible)
    if (nextModel) { setTask(nextTask); onModelChange(nextModel) }
  }
  const chooseModel = (nextModel: ModelKind) => { setTask(modelTask[nextModel]); onModelChange(nextModel) }
  const startTraining = () => { setCanvasView('training'); onStartTraining() }
  const resetTraining = () => { setCanvasView('training'); onResetTraining?.() }
  const handleTaskTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [])
    const currentIndex = tabs.indexOf(event.currentTarget)
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === undefined || tabs.length === 0) return
    event.preventDefault()
    const nextTab = tabs[nextIndex]
    const nextTask = nextTab.dataset.taskKind
    if (nextTask && nextTask in taskLabels) chooseTask(nextTask as TaskKind)
    nextTab.focus()
  }
  const handleCanvasTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [])
    const currentIndex = tabs.indexOf(event.currentTarget)
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === undefined || tabs.length === 0) return
    event.preventDefault()
    const nextTab = tabs[nextIndex]
    const nextView = nextTab.dataset.canvasView
    if (nextView === 'training' || nextView === 'results' || nextView === 'architecture') setCanvasView(nextView)
    nextTab.focus()
  }
  const activeCanvasView = canvasView === 'architecture' && !isVisualCnn ? 'training' : canvasView
  const isComplete = ['训练完成', '训练完成，保存失败'].includes(status)
  const canvasEyebrow = activeCanvasView === 'results' ? '模型解读' : activeCanvasView === 'architecture' ? '网络编辑' : '实时训练'
  const canvasTitle = activeCanvasView === 'results' ? '模型解释与结果' : activeCanvasView === 'architecture' ? 'CNN 网络结构' : '训练过程'
  const canvasDescription = activeCanvasView === 'results' ? '查看本轮实验的指标、预测表现和模型说明。' : activeCanvasView === 'architecture' ? '查看并调整卷积网络的层结构。' : '配置模型后开始训练，实时观察训练过程。'
  return <div className="single-page-workbench single-page-workbench--immersive single-page-workbench--two-columns">
    <aside className="single-page-column single-page-config" aria-label="实验配置">
      <header className="single-page-heading"><p className="eyebrow">模型配置</p><h2>实验配置</h2><p>先选择任务类型，再选择算法并调整参数。</p></header>
      <section className="single-page-card" aria-label="模型选择与参数">
        <h3>模型与参数</h3>
        <div className="task-tabs" role="tablist" aria-label="任务类型">{availableTasks.map((kind) => <button key={kind} data-task-kind={kind} type="button" role="tab" tabIndex={task === kind ? 0 : -1} disabled={isActive} aria-selected={task === kind} className={task === kind ? 'active' : ''} onKeyDown={handleTaskTabKeyDown} onClick={() => chooseTask(kind)}>{taskLabels[kind]}</button>)}</div>
        <label className="single-page-label">具体模型<select disabled={isActive} aria-label="具体模型" value={model ?? ''} onChange={(event) => event.target.value && chooseModel(event.target.value as ModelKind)}><option value="">请选择模型</option>{availableModels.map((kind) => <option key={kind} value={kind}>{modelName(kind)}</option>)}</select></label>
        {model ? <ModelParameterPanel key={model} disabled={isActive} onValidityChange={onParamsValidityChange} model={model} value={params} onChange={onParamsChange} /> : <p className="single-page-hint">请选择模型后配置参数。</p>}
        {onEvaluationConfigChange && model && (modelTask[model] === 'classification' || modelTask[model] === 'regression') && <fieldset className="evaluation-config" disabled={isActive}>
          <legend>验证集评估</legend>
          <label><input type="checkbox" checked={evaluationConfig.enabled} onChange={event => onEvaluationConfigChange({ ...evaluationConfig, enabled: event.target.checked })} /> 启用验证集（默认 20%）</label>
          {evaluationConfig.enabled && <><label>验证集比例<input type="number" min="0.1" max="0.8" step="0.05" value={evaluationConfig.validationSplit} onChange={event => onEvaluationConfigChange({ ...evaluationConfig, validationSplit: Number(event.target.value) })} /></label><label>划分随机种子<input type="number" step="1" value={evaluationConfig.seed} onChange={event => onEvaluationConfigChange({ ...evaluationConfig, seed: Number(event.target.value) })} /></label><small>训练集和验证集会按此配置确定性划分。</small></>}
        </fieldset>}
        {model && <p className="single-page-hint">{controllable ? `单步推进一个完整${effectiveCapability ? trainingUnitLabel(effectiveCapability.unit) : '训练单位'}；暂停会等待本轮计算结束。` : `该模型按“${effectiveCapability ? trainingUnitLabel(effectiveCapability.unit) : '拟合'}”完成，不支持暂停、继续或单步；可停止计算。`}</p>}
        {error && <p role="alert" className="single-page-error">{error}</p>}
        <div className="single-page-controls" aria-label="训练控制">
          <button type="button" className="primary-button" onClick={startTraining} disabled={!model || !visualNetworkValid || !parametersValid || isActive}>开始训练</button>
          <button type="button" onClick={onPauseTraining} disabled={!isRunning || !effectiveCapability?.canPause}>暂停</button><button type="button" onClick={onStepTraining} disabled={!isPaused || !effectiveCapability?.canStep}>单步</button>
          <button type="button" onClick={onResumeTraining} disabled={!isPaused || !effectiveCapability?.canPause}>继续</button><button type="button" onClick={onStopTraining} disabled={!isActive || !effectiveCapability?.canStop}>停止</button>
          <button type="button" onClick={resetTraining} disabled={!hasTraining}>重置</button>
        </div>
      </section>
    </aside>
    <main className={`single-page-column single-page-canvas single-page-canvas--two-columns${isVisualCnn ? ' single-page-canvas--cnn' : ''}`} aria-label="训练画布">
      <header className="single-page-heading workflow-dataset-header"><div><p className="eyebrow">{canvasEyebrow}</p><h2>{canvasTitle}</h2><p>{canvasDescription}</p></div></header>
      <section className="workflow-context-bar" aria-label="当前数据集" role="region"><div className="workflow-context-icon" aria-hidden="true">◈</div><div className="workflow-context-copy"><span>当前数据集</span><strong>{datasetName ?? '未命名数据集'}</strong></div>{onChangeDataset && <button type="button" className="workflow-context-action" disabled={isActive} onClick={onChangeDataset}>更换数据集<span aria-hidden="true">→</span></button>}</section>
      <div className="workbench-canvas-tabs" role="tablist" aria-label="画布视图">
        <button id="workbench-training-tab" data-canvas-view="training" type="button" role="tab" tabIndex={activeCanvasView === 'training' ? 0 : -1} aria-controls="workbench-canvas-panel" aria-selected={activeCanvasView === 'training'} onKeyDown={handleCanvasTabKeyDown} onClick={() => setCanvasView('training')}>训练过程</button>
        <button id="workbench-results-tab" data-canvas-view="results" type="button" role="tab" tabIndex={activeCanvasView === 'results' ? 0 : -1} aria-controls="workbench-canvas-panel" aria-selected={activeCanvasView === 'results'} onKeyDown={handleCanvasTabKeyDown} onClick={() => setCanvasView('results')}>结果与解释</button>
        {isVisualCnn && <button id="workbench-architecture-tab" data-canvas-view="architecture" type="button" role="tab" tabIndex={activeCanvasView === 'architecture' ? 0 : -1} aria-controls="workbench-canvas-panel" aria-selected={activeCanvasView === 'architecture'} onKeyDown={handleCanvasTabKeyDown} onClick={() => setCanvasView('architecture')}>网络结构</button>}
      </div>
      <div id="workbench-canvas-panel" className={`workbench-canvas-panel workbench-canvas-panel--${activeCanvasView}`} role="tabpanel" aria-labelledby={`workbench-${activeCanvasView === 'architecture' ? 'architecture' : activeCanvasView === 'results' ? 'results' : 'training'}-tab`}>
        {activeCanvasView === 'training' && <>
          <section data-testid={isVisualCnn ? 'cnn-training-card' : undefined} className="single-page-card training-canvas-card">
            <div className="single-page-status" role="status">{status}</div>
            {isPreparing && <p className="training-phase">{status === '准备训练' ? '正在检查数据和训练参数。' : '正在初始化模型，稍后将收到训练快照。'}</p>}
            {isActive && <section className="training-live" aria-label="实时训练反馈">
              <div className="training-live-values"><strong>第 {currentIteration} / {totalIterations ?? '—'} {effectiveCapability ? trainingUnitLabel(effectiveCapability.unit) : '训练单位'}</strong>{totalIterations ? <span>进度 {percent.toFixed(1)}%</span> : <span>进度：由算法阶段决定</span>}<span>当前损失：{lastSnapshot?.loss == null ? '等待快照' : lastSnapshot.loss.toFixed(4)}</span></div>
              {totalIterations ? <progress aria-label="训练进度" max={100} value={percent} /> : <p>当前算法按“{effectiveCapability ? trainingUnitLabel(effectiveCapability.unit) : '拟合'}”报告状态，不显示估算百分比。</p>}
              {lastSnapshot?.metrics && <p>准确率 {(lastSnapshot.metrics.accuracy * 100).toFixed(1)}% · 精确率 {(lastSnapshot.metrics.precision * 100).toFixed(1)}% · 召回率 {(lastSnapshot.metrics.recall * 100).toFixed(1)}%</p>}
            </section>}
            <div className="single-page-chart"><TrainingProgressChart snapshots={snapshots} status={status} /></div>
            {status === '训练失败' && snapshots.length > 0 && <details><summary>查看已收到的训练上下文（{snapshots.length} 个快照）</summary><p>最近迭代：{currentIteration}，损失：{lastSnapshot?.loss?.toFixed(4) ?? '无'}</p></details>}
          </section>
          {snapshots.length > 0 && <section className="single-page-card single-page-timeline-card"><h3>训练时间线</h3><ol className="single-page-timeline">{snapshots.slice(-8).map((snapshot) => <li key={`${snapshot.iteration}-${snapshot.timestamp}`}>{snapshot.iteration === 0 && snapshot.loss == null ? status === '训练完成' ? '已完成拟合' : '已接收训练快照' : `第 ${snapshot.iteration} 次迭代${snapshot.loss != null ? ` · 损失 ${snapshot.loss.toFixed(4)}` : ''}`}</li>)}</ol></section>}
        </>}
        {activeCanvasView === 'results' && <section className="single-page-card single-page-explanation" aria-label="模型解释与结果">
          <header className="single-page-heading"><p className="eyebrow">模型解读</p><h2>模型解释与结果</h2><p>理解模型如何做出预测。</p></header>
          <section className="single-page-card model-explanation-card"><h3>{modelName(model)}</h3>{explanation ?? <p className="single-page-hint">训练后将展示模型结构、关键参数和决策过程。</p>}</section>
          {isComplete && resultPanel ? resultPanel : isComplete && currentResult ? <CurrentResultPanel result={currentResult} /> : <p className="single-page-hint">{isComplete ? '本轮训练暂无可展示的评估结果。' : '训练完成后，这里会显示本轮实验的评估结果。'}</p>}
        </section>}
        {activeCanvasView === 'architecture' && isVisualCnn && activeDataset.imageShape && <section className="single-page-card single-page-architecture" aria-label="网络结构">
          <NetworkFlowCanvas layers={activeVisualLayers} imageShape={activeDataset.imageShape} outputClasses={new Set(activeDataset.labels).size} onChange={onVisualLayersChange} status={status} snapshots={snapshots} />
        </section>}
      </div>
    </main>
  </div>
}

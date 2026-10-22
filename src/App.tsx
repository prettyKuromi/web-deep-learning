import { ExperimentResultPanel } from './features/workbench/ExperimentResultPanel'
import { experimentSummary } from './features/workbench/resultUtils'
import { defaultParameters, validateParameters } from './features/training/modelParameters'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isModelCompatible, modelTask, recommendedModel, type ModelKind } from './app/workbenchTypes'
import { useWorkbenchStore } from './app/workbenchStore'
import { classificationMetrics } from './features/training/metrics'
import { createKnnTrainer } from './features/training/knn'
import { createLinearSvmTrainer } from './features/training/linearSvm'
import { createLogisticRegressionTrainer } from './features/training/logisticRegression'
import { createLinearRegressionTrainer, createRidgeRegressionTrainer } from './features/training/regression'
import { createKMeansTrainer } from './features/training/kmeans'
import { createPcaTrainer } from './features/training/pca'
import { createDecisionTreeTrainer } from './features/training/decisionTree'
import { createNaiveBayesTrainer } from './features/training/naiveBayes'
import { createAdaBoostTrainer, createPerceptronTrainer, createRandomForestTrainer } from './features/training/ensembles'
import { createDbscanTrainer } from './features/training/dbscan'
import { createMlpTrainer } from './features/training/mlp'
import { createVisualCnnTrainer } from './features/training/visualCnn'
import { createTrainInWorkerClient, runTrainingInHandler, type WorkerTrainConfig } from './features/training/workerClient'
import type { TrainingEvent } from './features/training/types'
import { regressionMetrics, selectLabels, selectRows, splitDataset, type EvaluationConfig } from './features/training/evaluation'
import { saveExperiment, exportExperiments, importExperiments, deleteExperiment } from './features/persistence/persistence'
import { HistoryPage, TopLevelNavigation, type TopLevelPage } from './features/workbench/HistoryPage'
import { DatasetPage, ModelPage } from './features/workbench/pages'
import type { DatasetImportState } from './features/datasets/DatasetPanel'
import { generateBuiltinDataset } from './features/datasets/dataset'
import { SinglePageWorkbench } from './features/workbench/SinglePageWorkbench'
import { ModelExplanationPanel } from './features/visualization/ModelExplanationPanel'
import { normalizeTrainSnapshot } from './features/training/snapshots'
import { defaultVisualLayers } from './features/training/visualNetwork'
import './App.css'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机', 'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', mlp: '多层感知机（MLP）', 'visual-cnn': '可视化卷积神经网络', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA' }
const defaults = Object.fromEntries((Object.keys(modelNames) as ModelKind[]).map(kind => [kind, defaultParameters(kind)])) as Record<ModelKind, Record<string, number>>
const createTrainer = (kind: ModelKind) => kind === 'knn' ? createKnnTrainer() : kind === 'logistic-regression' ? createLogisticRegressionTrainer() : kind === 'linear-svm' ? createLinearSvmTrainer() : kind === 'perceptron' ? createPerceptronTrainer() : kind === 'mlp' ? createMlpTrainer() : kind === 'visual-cnn' ? createVisualCnnTrainer() : kind === 'linear-regression' ? createLinearRegressionTrainer() : kind === 'ridge-regression' ? createRidgeRegressionTrainer() : kind === 'k-means' ? createKMeansTrainer() : kind === 'dbscan' ? createDbscanTrainer() : kind === 'pca' ? createPcaTrainer() : kind === 'decision-tree' ? createDecisionTreeTrainer() : kind === 'random-forest' ? createRandomForestTrainer() : kind === 'adaboost' ? createAdaBoostTrainer() : createNaiveBayesTrainer()
const predictionLabel = (kind: ModelKind, model: unknown, point: readonly number[]) => {
  const value = createTrainer(kind).predict(model as never, [point])[0]
  return Array.isArray(value) ? value[0] : value
}

export default function App() {
  const { dataset, setDataset, modelConfig, setModelConfig, training, setTraining, experiments, addExperiment } = useWorkbenchStore()
  const [currentExperimentId, setCurrentExperimentId] = useState<string>()
  const [historySelectedId, setHistorySelectedId] = useState<string>()
  const [topPage, setTopPage] = useState<TopLevelPage>('model')
  const [persistenceNotice, setPersistenceNotice] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [datasetConfirmed, setDatasetConfirmed] = useState(false)
  const [datasetImportState, setDatasetImportState] = useState<DatasetImportState>({ pending: false, error: '' })
  const [parametersValid, setParametersValid] = useState(true)
  const [selectedStep, setSelectedStep] = useState<number>()
  const [visualLayers, setVisualLayers] = useState(defaultVisualLayers)
  const [evaluationConfig, setEvaluationConfig] = useState<EvaluationConfig>({ enabled: false, validationSplit: 0.2, seed: 42 })
  useEffect(() => { if (typeof indexedDB !== 'undefined') void useWorkbenchStore.getState().loadExperiments().catch(error => setHistoryError(error instanceof Error ? error.message : '历史记录加载失败')) }, [])
  const abortRef = useRef<AbortController | null>(null)
  const workerClientRef = useRef<ReturnType<typeof createTrainInWorkerClient> | null>(null)
  const stopRequestedRef = useRef(false)
  const activeRunIdRef = useRef<string | undefined>(undefined)
  const trainers = useMemo(() => Object.fromEntries((Object.keys(defaults) as ModelKind[]).map((kind) => [kind, createTrainer(kind)])) as Record<string, any>, [])
  const currentExperiment = experiments.find((record) => record.id === currentExperimentId)
  const historySelected = experiments.find((record) => record.id === historySelectedId)
  const handleImportStateChange = useCallback((state: DatasetImportState) => {
    setDatasetImportState(state)
    if (state.pending || state.error) setDatasetConfirmed(false)
    if (state.error) setTraining({ status: '数据集错误', error: state.error })
  }, [setTraining])

  const runTraining = async () => {
    if (!modelConfig.kind) { setTraining({ status: '等待训练', error: '请先选择模型' }); return }
    if (!parametersValid || validateParameters(modelConfig.kind, modelConfig.params)) { setTraining({ error: '请先修正模型参数' }); return }
    if (modelTask[modelConfig.kind] === 'regression' && dataset.labels.some(label => typeof label !== 'number' || !Number.isFinite(label))) { setTraining({ error: '回归任务要求最后一列标签为有限数值，请更换数据集。' }); return }
    if (!isModelCompatible(modelConfig.kind, dataset).compatible) { setTraining({ status: '训练失败', error: isModelCompatible(modelConfig.kind, dataset).reason }); return }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    stopRequestedRef.current = false
    setSelectedStep(undefined)
    setCurrentExperimentId(undefined)
    setTraining({ status: '准备训练', progress: 0, snapshots: [], error: undefined, metrics: undefined, runId: undefined, capability: undefined })
    try {
      const kind = modelConfig.kind
      const effectiveParams = { ...defaultParameters(kind), ...modelConfig.params }
      const supervised = modelTask[kind] === 'classification' || modelTask[kind] === 'regression'
      const split = evaluationConfig.enabled && supervised
        ? splitDataset(dataset.labels, evaluationConfig, modelTask[kind] as 'classification' | 'regression')
        : { trainIndices: dataset.labels.map((_, index) => index), validationIndices: [], validationSplit: 0, seed: evaluationConfig.seed }
      const trainSamples = selectRows(dataset.features, split.trainIndices)
      const trainLabels = selectLabels(dataset.labels, split.trainIndices)
      const validationSamples = selectRows(dataset.features, split.validationIndices)
      const validationLabels = selectLabels(dataset.labels, split.validationIndices)
      const totalUpdates = effectiveParams.iterations ?? effectiveParams.epochs
      const trainer = trainers[kind] as any
      const snapshots: any[] = []
      const mlpParams = kind === 'mlp' ? { ...modelConfig.params, hiddenLayers: Array.from({ length: modelConfig.params.hiddenLayerCount ?? 2 }, () => modelConfig.params.hiddenUnits ?? 16) } : {}
      const cnnParams = kind === 'visual-cnn' ? { layers: visualLayers, imageShape: dataset.imageShape } : {}
      const config = { kind, samples: trainSamples, labels: trainLabels, ...effectiveParams, ...mlpParams, ...cnnParams } as WorkerTrainConfig
      let lastUiUpdate = 0
      let pendingSnapshot: ReturnType<typeof normalizeTrainSnapshot> | undefined
      const flushSnapshot = () => {
        if (!pendingSnapshot) return
        const normalized = pendingSnapshot
        pendingSnapshot = undefined
        setTraining({ snapshots: [...snapshots], progress: totalUpdates ? Math.min(100, normalized.iteration / totalUpdates * 100) : 0, metrics: normalized.metrics })
      }
      const onSnapshot = (snapshot: any) => {
        const normalized = normalizeTrainSnapshot(snapshot)
        snapshots.push(normalized)
        pendingSnapshot = normalized
        const now = Date.now()
        if (now - lastUiUpdate >= 100 || normalized.iteration >= (totalUpdates ?? Infinity)) { lastUiUpdate = now; flushSnapshot() }
      }
      const onEvent = (event: TrainingEvent) => {
        if (activeRunIdRef.current && event.runId !== activeRunIdRef.current) return
        activeRunIdRef.current = event.runId
        if (event.type === 'preparing') setTraining({ status: '准备训练', runId: event.runId, capability: event.capability })
        else if (event.type === 'initializing') setTraining({ status: '初始化模型', runId: event.runId, capability: event.capability })
        else if (event.type === 'started' || event.type === 'resumed') setTraining({ status: '训练中…', runId: event.runId, capability: event.capability })
        else if (event.type === 'paused') setTraining({ status: '训练已暂停', runId: event.runId, capability: event.capability })
        else if (event.type === 'stopped') setTraining({ status: '训练已停止', runId: event.runId, capability: event.capability })
        else if (event.type === 'cancelled') setTraining({ status: '训练已取消', runId: event.runId, capability: event.capability })
        else if (event.type === 'failed') setTraining({ status: '训练失败', runId: event.runId, error: event.message, capability: event.capability })
      }
      const result = typeof Worker === 'undefined'
        ? await runTrainingInHandler(config, onSnapshot, () => controller.signal.aborted)
        : await (workerClientRef.current = createTrainInWorkerClient()).trainInWorker(config, onSnapshot, controller.signal, paused => setTraining({ status: paused ? '训练已暂停' : '训练中…' }), onEvent)
      if (controller.signal.aborted || abortRef.current !== controller) return
      flushSnapshot()
      const predictions = trainer.predict(result.model, dataset.features)
      const trainPredictions = trainer.predict(result.model, trainSamples)
      if (predictions.flat().some((value: unknown) => typeof value === 'number' && !Number.isFinite(value))) throw new Error('训练数值不稳定，请降低学习率或标准化特征。')
      const metrics = modelTask[kind] === 'classification' ? classificationMetrics(trainLabels, trainPredictions) : undefined
      const trainMetrics = modelTask[kind] === 'classification'
        ? metrics
        : modelTask[kind] === 'regression'
          ? regressionMetrics(trainLabels as readonly number[], trainPredictions as readonly number[])
          : undefined
      const validationPredictions = validationSamples.length > 0 ? trainer.predict(result.model, validationSamples) : []
      const validationMetrics = evaluationConfig.enabled && validationSamples.length > 0
        ? modelTask[kind] === 'classification'
          ? classificationMetrics(validationLabels, validationPredictions)
          : modelTask[kind] === 'regression'
            ? regressionMetrics(validationLabels as readonly number[], validationPredictions as readonly number[])
            : undefined
        : undefined
      const record = { id: String(Date.now()), createdAt: Date.now(), dataset, modelKind: kind, config: { ...effectiveParams, ...mlpParams, ...cnnParams }, metrics, evaluation: evaluationConfig.enabled && supervised ? { config: evaluationConfig, trainSampleCount: trainSamples.length, validationSampleCount: validationSamples.length, trainMetrics, validationMetrics } : undefined, snapshots: result.snapshots, model: result.model, predictions }
      addExperiment(record)
      void saveExperiment(record).then(() => setPersistenceNotice('')).catch(() => { setPersistenceNotice(''); setTraining({ status: '训练完成，保存失败', error: '训练结果已生成，但未能写入本地历史记录；导出实验可保留结果。' }) })
      setTraining({ status: '训练完成', progress: 100, snapshots: result.snapshots, metrics })
      setCurrentExperimentId(record.id)
      setHistorySelectedId(record.id)
    } catch (error) {
      if (abortRef.current !== controller) return
      setTraining({ status: stopRequestedRef.current ? '训练已停止' : error instanceof DOMException && error.name === 'AbortError' ? '训练已取消' : '训练失败', error: stopRequestedRef.current ? undefined : error instanceof Error && /[\u4e00-\u9fff]/.test(error.message) ? error.message : '训练失败：请检查数据维度、标签及参数范围，或降低学习率后重试。' })
    } finally {
      if (abortRef.current === controller) workerClientRef.current = null
    }
  }

  const pauseTraining = () => { if (!workerClientRef.current || training.status !== '训练中…') return; workerClientRef.current.sendControl('pause') }
  const resumeTraining = () => { if (!workerClientRef.current || training.status !== '训练已暂停') return; workerClientRef.current.sendControl('resume') }
  const stepTraining = () => {
    if (training.status === '训练已暂停') workerClientRef.current?.sendControl('step')
  }
  const stopTraining = () => { stopRequestedRef.current = true; workerClientRef.current?.sendControl('stop'); setCurrentExperimentId(undefined) }
  const resetTraining = () => { abortRef.current?.abort(); abortRef.current = null; workerClientRef.current = null; setCurrentExperimentId(undefined); setSelectedStep(undefined); setTraining({ status: '等待训练', progress: 0, snapshots: [], error: undefined, metrics: undefined }) }
  const invalidateConfiguration = () => { resetTraining(); setTraining({ status: '配置已修改，请重新训练' }) }
  const handleDatasetChange = (nextDataset: typeof dataset) => {
    abortRef.current?.abort()
    abortRef.current = null
    workerClientRef.current = null
    setDatasetConfirmed(false)
    setDatasetImportState({ pending: false, error: '' })
    setSelectedStep(undefined)
    setCurrentExperimentId(undefined)
    setDataset(nextDataset)
    if (modelConfig.kind && !isModelCompatible(modelConfig.kind, nextDataset).compatible) setModelConfig({ kind: recommendedModel(nextDataset), params: defaults[recommendedModel(nextDataset)] })
    setTraining({ status: '请重新训练', progress: 0, snapshots: [], error: undefined, metrics: undefined })
  }

  const handleModelSelection = (kind: ModelKind) => {
    if (modelConfig.kind === kind) return
    abortRef.current?.abort()
    abortRef.current = null
    workerClientRef.current = null
    setParametersValid(true)
    setDatasetConfirmed(false)
    setDatasetImportState({ pending: false, error: '' })
    setSelectedStep(undefined)
    setCurrentExperimentId(undefined)
    setModelConfig({ kind, params: defaults[kind] })
    if (!isModelCompatible(kind, dataset).compatible) {
      setDataset(kind === 'visual-cnn' ? generateBuiltinDataset('digits') : generateBuiltinDataset('linear'))
    }
    setTraining({ status: '请重新训练', progress: 0, snapshots: [], error: undefined, metrics: undefined })
  }

  const handleTopPageChange = (page: TopLevelPage) => {
    if (page === 'workflow' && !datasetConfirmed) return
    if (page !== 'history' && ['训练中…', '训练已暂停'].includes(training.status)) return
    setTopPage(page)
  }

  const records = experiments.map((record) => ({ id: record.id, datasetName: record.dataset.name ?? '未命名数据集', model: modelNames[record.modelKind], modelKind: record.modelKind, snapshots: record.snapshots, runMetadata: record.runMetadata, timestamp: new Date(record.createdAt).toLocaleString('zh-CN'), summary: experimentSummary(record), metrics: record.metrics ?? {} }))
  const activeModel = modelConfig.kind ?? recommendedModel(dataset)
  const explanationPanel = <ModelExplanationPanel kind={activeModel} model={currentExperiment?.model} snapshots={training.snapshots} selectedStep={training.status === '训练中…' ? undefined : selectedStep} onStepChange={setSelectedStep} status={training.status} dimensions={dataset.features[0]?.length} />
  return <main className="app-shell">
    <header className="app-header"><div className="brand-lockup"><div className="brand-mark">✦</div><div><p className="eyebrow">web-deep-learning</p><h1>机器学习实验工作台</h1><p className="header-subtitle">先选模型，再筛选数据集并观察训练结果。</p></div></div><div className="header-meta"><span className="live-dot" /><span>浏览器端运行</span><span className="status-badge">实验版</span></div></header>
    <TopLevelNavigation activePage={topPage} configurationDisabled={['训练中…', '训练已暂停'].includes(training.status)} datasetDisabled={!modelConfig.kind} workflowDisabled={!datasetConfirmed} onPageChange={handleTopPageChange} />
    <section className="app-content">{topPage === 'model' ? <ModelPage value={activeModel} onChange={handleModelSelection} onContinue={() => { if (!modelConfig.kind) handleModelSelection(activeModel); setTopPage('dataset') }} /> : topPage === 'dataset' ? <DatasetPage model={activeModel} initialDataset={dataset} importState={datasetImportState} onImportStateChange={handleImportStateChange} onDatasetChange={handleDatasetChange} onValidityChange={(valid) => { if (!valid) setDatasetConfirmed(false) }} onError={(message) => setTraining({ status: '数据集错误', error: message })} onContinue={() => { if (datasetImportState.pending || datasetImportState.error) return; setDatasetConfirmed(true); setTopPage('workflow') }} /> : topPage === 'workflow' ? <SinglePageWorkbench
      dataset={dataset} visualLayers={visualLayers} onVisualLayersChange={layers => { invalidateConfiguration(); setVisualLayers(layers) }} model={activeModel} params={modelConfig.params} datasetName={dataset.name} status={training.status} snapshots={training.snapshots} capability={training.capability} evaluationConfig={evaluationConfig} onEvaluationConfigChange={config => { invalidateConfiguration(); setEvaluationConfig(config) }}
      onDatasetChange={handleDatasetChange} onChangeDataset={() => setTopPage('dataset')} onDatasetError={(message) => setTraining({ status: '数据集错误', error: message })}
      parametersValid={parametersValid} onParamsValidityChange={valid => { setParametersValid(valid); if (!valid) invalidateConfiguration() }}
      onModelChange={(kind) => { resetTraining(); setParametersValid(true); setModelConfig({ kind, params: defaults[kind] }) }} onParamsChange={(params) => { invalidateConfiguration(); setModelConfig({ params }) }}
      onStartTraining={runTraining} onPauseTraining={pauseTraining} onStepTraining={stepTraining} onResumeTraining={resumeTraining} onStopTraining={stopTraining} onResetTraining={resetTraining}
      explanation={explanationPanel} resultPanel={currentExperiment ? <ExperimentResultPanel record={currentExperiment} predict={(point) => predictionLabel(currentExperiment.modelKind, currentExperiment.model, point)} /> : undefined} error={training.error}
    /> : <HistoryPage records={records} selectedId={historySelectedId} onSelect={(item) => setHistorySelectedId(item.id)} selectedDetail={historySelected ? <ExperimentDetail record={historySelected} /> : undefined} importError={historyError || persistenceNotice} onExport={async () => { const json = await exportExperiments(useWorkbenchStore.getState().experiments); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'web-deep-learning-experiments.json'; anchor.click(); URL.revokeObjectURL(url) }} onImport={async (file: File) => { try { const records = await importExperiments(await file.text()); useWorkbenchStore.getState().mergeExperiments(records); setHistoryError('') } catch (error) { setHistoryError(error instanceof Error ? error.message : '导入失败') } }} onDelete={(id) => { void Promise.resolve(deleteExperiment(id)).then(() => { useWorkbenchStore.getState().removeExperiment(id); if (historySelectedId === id) setHistorySelectedId(undefined) }).catch(() => setHistoryError('删除失败：本地存储不可用')) }} />}</section>
  </main>
}

const parameterLabels: Record<string, string> = { learningRate: '学习率', iterations: '迭代次数', regularization: '正则化强度', epochs: '训练轮数', batchSize: '批大小', seed: '随机种子', k: '邻居数（k）', margin: '间隔', trees: '树数量', maxDepth: '最大深度', minSamplesSplit: '最小分裂样本数', rounds: '训练轮数', varianceSmoothing: '方差平滑', epsilon: '邻域半径', minPoints: '最小样本数', components: '主成分数量', hiddenLayerCount: '隐藏层数量', hiddenUnits: '每层神经元数', layers: '网络层配置', imageShape: '图像尺寸' }

export function formatParameterLabel(key: string, modelKind?: ModelKind) {
  return key === 'k' && modelKind === 'k-means' ? '簇数量（k）' : parameterLabels[key] ?? key
}

export function formatParameterValue(key: string, value: unknown) {
  if (key === 'imageShape' && value && typeof value === 'object') {
    const shape = value as Record<string, unknown>
    if (typeof shape.width === 'number' && typeof shape.height === 'number' && typeof shape.channels === 'number') return `${shape.height} × ${shape.width} 像素 · ${shape.channels} 通道`
  }
  if (key === 'layers' && Array.isArray(value)) return value.map((layer, index) => {
    if (!layer || typeof layer !== 'object') return `第 ${index + 1} 层`
    const item = layer as Record<string, unknown>
    const names: Record<string, string> = { conv2d: '卷积层', 'max-pool': '最大池化', dense: '全连接层', activation: '激活层', dropout: 'Dropout' }
    const activations: Record<string, string> = { relu: 'ReLU', tanh: '双曲正切（Tanh）', sigmoid: 'Sigmoid', softmax: 'Softmax', linear: '线性' }
    const detail = item.type === 'conv2d' ? `，${String(item.filters)} 个滤波器` : item.type === 'dense' ? `，${String(item.units)} 个神经元` : item.type === 'activation' ? `，${activations[String(item.activation)] ?? String(item.activation)}` : item.type === 'dropout' ? `，丢弃率 ${Math.round(Number(item.rate) * 100)}%` : ''
    return `第 ${index + 1} 层：${names[String(item.type)] ?? '网络层'}${detail}`
  }).join('；')
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

function ExperimentDetail({ record }: { record: ReturnType<typeof useWorkbenchStore.getState>['experiments'][number] }) {
  return <section className="result-detail workbench-page-card"><h2>{modelNames[record.modelKind]} · {record.dataset.name ?? '数据集'}</h2><p className="history-detail-meta">{record.dataset.features.length} 条样本 · {record.dataset.features[0]?.length ?? 0} 个特征 · {new Date(record.createdAt).toLocaleString('zh-CN')}</p><h3>训练参数</h3><dl className="experiment-parameters">{Object.entries(record.config).map(([key, value]) => <div key={key}><dt>{formatParameterLabel(key, record.modelKind)}</dt><dd>{formatParameterValue(key, value)}</dd></div>)}</dl><ExperimentResultPanel record={record} predict={(point) => predictionLabel(record.modelKind, record.model, point)} /></section>
}

import { ExperimentResultPanel } from './features/workbench/ExperimentResultPanel'
import { experimentSummary } from './features/workbench/resultUtils'
import { defaultParameters, validateParameters } from './features/training/modelParameters'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isModelCompatible, modelTask, recommendedModel, type ExperimentRecord, type ModelKind } from './app/workbenchTypes'
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
import { createLstmTrainer } from './features/training/lstm'
import { createTransformerTrainer } from './features/training/transformer'
import { createTrainInWorkerClient, runTrainingInHandler, type WorkerTrainConfig } from './features/training/workerClient'
import type { TrainingEvent, TrainingUnit } from './features/training/types'
import { regressionMetrics, selectLabels, selectRows, splitDataset, type EvaluationConfig } from './features/training/evaluation'
import { saveExperiment, exportExperiments, importExperiments, deleteExperiment } from './features/persistence/persistence'
import { datasetFingerprint, createRunMetadata, serializeExperimentReport, reportFilename } from './features/persistence/reproducibility'
import { experimentMetricGroups } from './features/persistence/experimentMetrics'
import { HistoryPage, TopLevelNavigation, type TopLevelPage } from './features/workbench/HistoryPage'
import { formatParameterLabel, formatParameterValue } from './features/workbench/experimentParameterFormat'
import { ExperimentSetupPage } from './features/workbench/pages'
import type { DatasetImportState } from './features/datasets/DatasetPanel'
import { asRegressionDataset, generateBuiltinDataset } from './features/datasets/dataset'
import { SinglePageWorkbench } from './features/workbench/SinglePageWorkbench'
import { ModelExplanationPanel } from './features/visualization/ModelExplanationPanel'
import { normalizeTrainSnapshot } from './features/training/snapshots'
import { createTrainingControl, supportsTrainingControl } from './features/training/trainingControl'
import { getTrainingCapability } from './features/training/trainingCapabilities'
import { defaultVisualLayers } from './features/training/visualNetwork'
import './App.css'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机', 'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', mlp: '多层感知机（MLP）', 'visual-cnn': '可视化卷积神经网络', lstm: 'LSTM', transformer: 'Transformer', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA' }
const defaults = Object.fromEntries((Object.keys(modelNames) as ModelKind[]).map(kind => [kind, defaultParameters(kind)])) as Record<ModelKind, Record<string, number>>
const createTrainer = (kind: ModelKind) => kind === 'knn' ? createKnnTrainer() : kind === 'logistic-regression' ? createLogisticRegressionTrainer() : kind === 'linear-svm' ? createLinearSvmTrainer() : kind === 'perceptron' ? createPerceptronTrainer() : kind === 'mlp' ? createMlpTrainer() : kind === 'visual-cnn' ? createVisualCnnTrainer() : kind === 'lstm' ? createLstmTrainer() : kind === 'transformer' ? createTransformerTrainer() : kind === 'linear-regression' ? createLinearRegressionTrainer() : kind === 'ridge-regression' ? createRidgeRegressionTrainer() : kind === 'k-means' ? createKMeansTrainer() : kind === 'dbscan' ? createDbscanTrainer() : kind === 'pca' ? createPcaTrainer() : kind === 'decision-tree' ? createDecisionTreeTrainer() : kind === 'random-forest' ? createRandomForestTrainer() : kind === 'adaboost' ? createAdaBoostTrainer() : createNaiveBayesTrainer()
const predictionLabel = (kind: ModelKind, model: unknown, point: readonly number[]) => {
  const value = createTrainer(kind).predict(model as never, [point])[0]
  return Array.isArray(value) ? value[0] : value
}

export default function App() {
  const { dataset, setDataset, modelConfig, setModelConfig, training, setTraining, experiments, addExperiment } = useWorkbenchStore()
  const [currentExperimentId, setCurrentExperimentId] = useState<string>()
  const [historySelectedId, setHistorySelectedId] = useState<string>()
  const [topPage, setTopPage] = useState<TopLevelPage>('setup')
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
  const localControlRef = useRef<ReturnType<typeof createTrainingControl> | null>(null)
  const localStopRef = useRef<(() => void) | null>(null)
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
    const kind = modelConfig.kind
    let trainingDataset = dataset
    if (modelTask[kind] === 'regression') {
      try { trainingDataset = asRegressionDataset(dataset) }
      catch (error) { setTraining({ status: '数据集错误', error: error instanceof Error ? error.message : '回归目标列必须为有限数值' }); return }
    }
    if (!parametersValid || validateParameters(kind, modelConfig.params)) { setTraining({ error: '请先修正模型参数' }); return }
    if (!isModelCompatible(kind, trainingDataset).compatible) { setTraining({ status: '训练失败', error: isModelCompatible(kind, trainingDataset).reason }); return }
    if (typeof Worker === 'undefined' && import.meta.env.MODE !== 'test') { resetTraining(); setTraining({ status: '训练失败', error: '当前浏览器不支持 Web Worker，无法安全执行训练。请使用支持 Web Worker 的浏览器后重试。' }); return }
    localControlRef.current?.send('cancel')
    abortRef.current?.abort()
    const controller = new AbortController()
    const startedAt = Date.now()
    abortRef.current = controller
    localControlRef.current = null
    localStopRef.current = null
    stopRequestedRef.current = false
    setSelectedStep(undefined)
    setCurrentExperimentId(undefined)
    setTraining({ status: '准备训练', progress: 0, snapshots: [], error: undefined, metrics: undefined, runId: undefined, capability: undefined })
    const effectiveParams = { ...defaultParameters(kind), ...modelConfig.params }
    let recordConfig: Record<string, unknown> = { ...effectiveParams }
    let snapshots: ReturnType<typeof normalizeTrainSnapshot>[] = []
    let trainingUnit: TrainingUnit | undefined
    let stopConfirmed = false
    let partialEvaluation: ExperimentRecord['evaluation']
    let totalUpdates: number | undefined
    const seed = typeof effectiveParams.seed === 'number' ? effectiveParams.seed : evaluationConfig.seed
    try {
      const supervised = modelTask[kind] === 'classification' || modelTask[kind] === 'regression'
      const split = evaluationConfig.enabled && supervised
        ? splitDataset(trainingDataset.labels, evaluationConfig, modelTask[kind] as 'classification' | 'regression')
        : { trainIndices: trainingDataset.labels.map((_, index) => index), validationIndices: [], validationSplit: 0, seed: evaluationConfig.seed }
      const trainSamples = selectRows(trainingDataset.features, split.trainIndices)
      const trainLabels = selectLabels(trainingDataset.labels, split.trainIndices)
      const validationSamples = selectRows(trainingDataset.features, split.validationIndices)
      const validationLabels = selectLabels(trainingDataset.labels, split.validationIndices)
      partialEvaluation = evaluationConfig.enabled && supervised ? { config: evaluationConfig, trainSampleCount: trainSamples.length, validationSampleCount: validationSamples.length } : undefined
      totalUpdates = effectiveParams.iterations ?? effectiveParams.epochs ?? effectiveParams.trees ?? effectiveParams.rounds
      const trainer = trainers[kind] as any
      const mlpParams = kind === 'mlp' ? { ...modelConfig.params, hiddenLayers: Array.from({ length: modelConfig.params.hiddenLayerCount ?? 2 }, () => modelConfig.params.hiddenUnits ?? 16) } : {}
      const cnnParams = kind === 'visual-cnn' ? { layers: visualLayers, imageShape: dataset.imageShape } : {}
      const sequenceParams = kind === 'lstm' || kind === 'transformer' ? { sequenceShape: trainingDataset.sequenceShape } : {}
      recordConfig = { ...effectiveParams, ...mlpParams, ...cnnParams }
      const config = { kind, samples: trainSamples, labels: trainLabels, ...effectiveParams, ...mlpParams, ...cnnParams, ...sequenceParams } as WorkerTrainConfig
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
        trainingUnit = normalized.unit ?? trainingUnit
        pendingSnapshot = normalized
        const now = Date.now()
        if (now - lastUiUpdate >= 100 || normalized.iteration >= (totalUpdates ?? Infinity)) { lastUiUpdate = now; flushSnapshot() }
      }
      const onEvent = (event: TrainingEvent) => {
        if (activeRunIdRef.current && event.runId !== activeRunIdRef.current) return
        activeRunIdRef.current = event.runId
        trainingUnit = event.capability?.unit ?? trainingUnit
        if (event.type === 'preparing') setTraining({ status: '准备训练', runId: event.runId, capability: event.capability })
        else if (event.type === 'initializing') setTraining({ status: '初始化模型', runId: event.runId, capability: event.capability })
        else if (event.type === 'started' || event.type === 'resumed') setTraining({ status: '训练中…', runId: event.runId, capability: event.capability })
        else if (event.type === 'paused') { flushSnapshot(); setTraining({ status: '训练已暂停', runId: event.runId, capability: event.capability }) }
        else if (event.type === 'step-completed') flushSnapshot()
        else if (event.type === 'stopped') { stopConfirmed = true; flushSnapshot(); setTraining({ status: '训练已停止', runId: event.runId, capability: event.capability }) }
        else if (event.type === 'cancelled') setTraining({ status: '训练已取消', runId: event.runId, capability: event.capability })
        else if (event.type === 'failed') setTraining({ status: '训练失败', runId: event.runId, error: event.message, capability: event.capability })
      }
      let result: Awaited<ReturnType<typeof runTrainingInHandler>>
      if (typeof Worker === 'undefined') {
        const runId = `local-${startedAt}`
        const capability = getTrainingCapability(kind, config as unknown as Record<string, unknown>)
        activeRunIdRef.current = runId
        const emitLocalEvent = (type: 'preparing' | 'initializing' | 'started' | 'paused' | 'resumed' | 'step-completed' | 'stopped' | 'completed') => onEvent({ type, runId, capability })
        let stepRequested = false
        let stepInProgress = false
        const localControl = supportsTrainingControl(kind) ? createTrainingControl(
          paused => emitLocalEvent(paused ? 'paused' : 'resumed'),
          () => { stepRequested = true },
        ) : null
        localControlRef.current = localControl
        const control = localControl ? {
          async checkpoint() {
            if (stepInProgress) { emitLocalEvent('step-completed'); stepInProgress = false }
            await localControl.checkpoint()
            if (stepRequested) { stepRequested = false; stepInProgress = true }
          },
          async yield() {
            await localControl.yield?.()
            if (controller.signal.aborted || stopRequestedRef.current) throw new DOMException('训练已取消', 'AbortError')
          },
        } : undefined
        localStopRef.current = () => {
          if (localControl) { stopConfirmed = true; emitLocalEvent('stopped'); localControl.send('stop') }
          else controller.abort()
        }
        emitLocalEvent('preparing')
        emitLocalEvent('initializing')
        emitLocalEvent('started')
        result = await runTrainingInHandler(config, onSnapshot, () => controller.signal.aborted, control)
        if (stepInProgress) emitLocalEvent('step-completed')
        emitLocalEvent('completed')
      } else {
        result = await (workerClientRef.current = createTrainInWorkerClient()).trainInWorker(config, onSnapshot, controller.signal, paused => setTraining({ status: paused ? '训练已暂停' : '训练中…' }), onEvent)
      }
      if (controller.signal.aborted || abortRef.current !== controller) return
      flushSnapshot()
      const predictions = trainer.predict(result.model, trainingDataset.features)
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
      const completedAt = Date.now()
      const record: ExperimentRecord = { id: String(completedAt), createdAt: completedAt, dataset: trainingDataset, modelKind: kind, config: recordConfig, metrics, evaluation: evaluationConfig.enabled && supervised ? { config: evaluationConfig, trainSampleCount: trainSamples.length, validationSampleCount: validationSamples.length, trainMetrics, validationMetrics } : undefined, snapshots: result.snapshots, model: result.model, predictions, runMetadata: { ...createRunMetadata(startedAt, completedAt, seed, trainingUnit, 'completed'), datasetFingerprint: await datasetFingerprint(trainingDataset), evaluation: evaluationConfig.enabled && supervised ? { source: '训练集/验证集划分', split: `${Math.round(evaluationConfig.validationSplit * 100)}%` } : { source: '全量数据' } } }
      addExperiment(record)
      void saveExperiment(record).then(() => setPersistenceNotice('')).catch(() => { setPersistenceNotice(''); setTraining({ status: '训练完成，保存失败', error: '训练结果已生成，但未能写入本地历史记录；导出实验可保留结果。' }) })
      setTraining({ status: '训练完成', progress: 100, snapshots: result.snapshots, metrics })
      setCurrentExperimentId(record.id)
      setHistorySelectedId(record.id)
    } catch (error) {
      if (abortRef.current !== controller) return
      if (stopRequestedRef.current && stopConfirmed) {
        const completedAt = Date.now()
        const fingerprint = await datasetFingerprint(trainingDataset)
        const record: ExperimentRecord = {
          id: String(completedAt), createdAt: completedAt, dataset: trainingDataset, modelKind: kind, config: recordConfig,
          evaluation: partialEvaluation, snapshots, predictions: [],
          runMetadata: { ...createRunMetadata(startedAt, completedAt, seed, trainingUnit, 'stopped'), datasetFingerprint: fingerprint, evaluation: partialEvaluation ? { source: '训练集/验证集划分', split: `${Math.round(evaluationConfig.validationSplit * 100)}%` } : { source: '全量数据' } },
        }
        addExperiment(record)
        setHistorySelectedId(record.id)
        void saveExperiment(record).then(() => setPersistenceNotice('')).catch(() => setPersistenceNotice('训练已停止；停止记录保存失败'))
        const lastSnapshot = snapshots.at(-1)
        const progress = totalUpdates && lastSnapshot ? Math.min(100, lastSnapshot.iteration / totalUpdates * 100) : 0
        setTraining({ status: '训练已停止', progress, snapshots: [...snapshots], metrics: lastSnapshot?.metrics })
      } else setTraining({ status: error instanceof DOMException && error.name === 'AbortError' ? '训练已取消' : '训练失败', error: error instanceof Error && /[\u4e00-\u9fff]/.test(error.message) ? error.message : '训练失败：请检查数据维度、标签及参数范围，或降低学习率后重试。' })
    } finally {
      if (abortRef.current === controller) { workerClientRef.current = null; localControlRef.current = null; localStopRef.current = null }
    }
  }

  const sendTrainingControl = (control: 'pause' | 'resume' | 'step') => { if (workerClientRef.current) workerClientRef.current.sendControl(control); else localControlRef.current?.send(control) }
  const pauseTraining = () => { if (training.status !== '训练中…') return; sendTrainingControl('pause') }
  const resumeTraining = () => { if (training.status !== '训练已暂停') return; sendTrainingControl('resume') }
  const stepTraining = () => {
    if (training.status === '训练已暂停') sendTrainingControl('step')
  }
  const stopTraining = () => { stopRequestedRef.current = true; if (localStopRef.current) localStopRef.current(); else workerClientRef.current?.sendControl('stop'); setCurrentExperimentId(undefined) }
  const resetTraining = () => { stopRequestedRef.current = false; activeRunIdRef.current = undefined; localControlRef.current?.send('cancel'); abortRef.current?.abort(); abortRef.current = null; workerClientRef.current = null; localControlRef.current = null; localStopRef.current = null; setCurrentExperimentId(undefined); setSelectedStep(undefined); setTraining({ status: '等待训练', progress: 0, snapshots: [], error: undefined, metrics: undefined, runId: undefined, capability: undefined }) }
  const invalidateConfiguration = () => { resetTraining(); setTraining({ status: '配置已修改，请重新训练' }) }
  const handleDatasetChange = (nextDataset: typeof dataset) => {
    localControlRef.current?.send('cancel')
    abortRef.current?.abort()
    abortRef.current = null
    workerClientRef.current = null
    localControlRef.current = null
    localStopRef.current = null
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
    localControlRef.current?.send('cancel')
    abortRef.current?.abort()
    abortRef.current = null
    workerClientRef.current = null
    localControlRef.current = null
    localStopRef.current = null
    setParametersValid(true)
    setDatasetConfirmed(false)
    setDatasetImportState({ pending: false, error: '' })
    setSelectedStep(undefined)
    setCurrentExperimentId(undefined)
    setModelConfig({ kind, params: defaults[kind] })
    if (!isModelCompatible(kind, dataset).compatible) {
      setDataset(generateBuiltinDataset(kind === 'visual-cnn' ? 'digits' : kind === 'lstm' || kind === 'transformer' ? 'sequence-waves' : 'linear'))
    }
    setTraining({ status: '请重新训练', progress: 0, snapshots: [], error: undefined, metrics: undefined })
  }

  const enterWorkflow = () => { resetTraining(); setTopPage('workflow') }
  const trainingActive = ['准备训练', '初始化模型', '训练中…', '训练已暂停'].includes(training.status)
  const handleTopPageChange = (page: TopLevelPage) => {
    if (page === 'workflow' && !datasetConfirmed) return
    if (page === 'setup' && trainingActive) return
    if (page === 'workflow' && topPage !== 'workflow') {
      if (trainingActive) { setTopPage('workflow'); return }
      enterWorkflow(); return
    }
    setTopPage(page)
  }

  const records = experiments.map((record) => ({ id: record.id, datasetName: record.dataset.name ?? '未命名数据集', model: modelNames[record.modelKind], modelKind: record.modelKind, task: modelTask[record.modelKind], snapshots: record.snapshots, runMetadata: record.runMetadata, timestamp: new Date(record.createdAt).toLocaleString('zh-CN'), summary: experimentSummary(record), metrics: record.metrics ?? {}, sampleCount: record.dataset.features.length, featureCount: record.dataset.features[0]?.length ?? 0, sequenceShape: record.dataset.sequenceShape, config: record.config, evaluation: record.evaluation, metricGroups: experimentMetricGroups(record) }))
  const activeModel = modelConfig.kind ?? recommendedModel(dataset)
  const explanationPanel = <ModelExplanationPanel kind={activeModel} model={currentExperiment?.model} snapshots={training.snapshots} selectedStep={training.status === '训练中…' ? undefined : selectedStep} onStepChange={setSelectedStep} status={training.status} dimensions={dataset.dataType === 'sequence' ? undefined : dataset.features[0]?.length} />
  return <main className="app-shell">
    <header className="app-header"><div className="brand-lockup"><div className="brand-mark">✦</div><div><p className="eyebrow">web-deep-learning</p><h1>机器学习实验工作台</h1><p className="header-subtitle">选择模型与数据后，观察训练过程和结果。</p></div></div><div className="header-meta"><span className="live-dot" /><span>浏览器端运行</span><span className="status-badge">实验版</span></div></header>
    <TopLevelNavigation activePage={topPage} configurationDisabled={trainingActive} workflowDisabled={!datasetConfirmed} onPageChange={handleTopPageChange} />
    <section className="app-content">{topPage === 'setup' ? <ExperimentSetupPage model={activeModel} onModelChange={handleModelSelection} initialDataset={dataset} importState={datasetImportState} onImportStateChange={handleImportStateChange} onDatasetChange={handleDatasetChange} onValidityChange={(valid) => { if (!valid) setDatasetConfirmed(false) }} onError={(message) => setTraining({ status: '数据集错误', error: message })} onContinue={() => { if (datasetImportState.pending || datasetImportState.error) return; if (!modelConfig.kind) handleModelSelection(activeModel); setDatasetConfirmed(true); enterWorkflow() }} /> : topPage === 'workflow' ? <SinglePageWorkbench
      dataset={dataset} visualLayers={visualLayers} onVisualLayersChange={layers => { invalidateConfiguration(); setVisualLayers(layers) }} model={activeModel} params={modelConfig.params} datasetName={dataset.name} status={training.status} snapshots={training.snapshots} capability={training.capability} evaluationConfig={evaluationConfig} onEvaluationConfigChange={config => { invalidateConfiguration(); setEvaluationConfig(config) }}
      onDatasetChange={handleDatasetChange} onChangeDataset={() => handleTopPageChange('setup')} onDatasetError={(message) => setTraining({ status: '数据集错误', error: message })}
      parametersValid={parametersValid} onParamsValidityChange={valid => { setParametersValid(valid); if (!valid) invalidateConfiguration() }}
      onModelChange={(kind) => { resetTraining(); setParametersValid(true); setModelConfig({ kind, params: defaults[kind] }) }} onParamsChange={(params) => { invalidateConfiguration(); setModelConfig({ params }) }}
      onStartTraining={runTraining} onPauseTraining={pauseTraining} onStepTraining={stepTraining} onResumeTraining={resumeTraining} onStopTraining={stopTraining} onResetTraining={resetTraining}
      explanation={explanationPanel} resultPanel={currentExperiment ? <ExperimentResultPanel record={currentExperiment} predict={(point) => predictionLabel(currentExperiment.modelKind, currentExperiment.model, point)} /> : undefined} error={training.error}
    /> : <HistoryPage records={records} selectedId={historySelectedId} onSelect={(item) => setHistorySelectedId(item.id)} selectedDetail={historySelected ? <ExperimentDetail record={historySelected} /> : undefined} importError={historyError || persistenceNotice} onExport={async () => { const json = await exportExperiments(useWorkbenchStore.getState().experiments); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'web-deep-learning-experiments.json'; anchor.click(); URL.revokeObjectURL(url) }} onExportReport={async (format) => { if (!historySelected) return; try { const content = await serializeExperimentReport(historySelected, format); anchorDownload(content, format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8', reportFilename(historySelected, format)); setHistoryError('') } catch (error) { setHistoryError(error instanceof Error ? error.message : '报告导出失败：请稍后重试') } }} onImport={async (file: File) => { try { const records = await importExperiments(await file.text()); useWorkbenchStore.getState().mergeExperiments(records); setHistoryError('') } catch (error) { setHistoryError(error instanceof Error ? error.message : '导入失败') } }} onDelete={(id) => { void Promise.resolve(deleteExperiment(id)).then(() => { useWorkbenchStore.getState().removeExperiment(id); if (historySelectedId === id) setHistorySelectedId(undefined) }).catch(() => setHistoryError('删除失败：本地存储不可用')) }} />}</section>
  </main>
}

function ExperimentDetail({ record }: { record: ReturnType<typeof useWorkbenchStore.getState>['experiments'][number] }) {
  const stopped = record.runMetadata?.status === 'stopped'
  return <section className="result-detail workbench-page-card"><h2>{modelNames[record.modelKind]} · {record.dataset.name ?? '数据集'}</h2><p className="history-detail-meta">{record.dataset.features.length} 条样本 · {record.dataset.sequenceShape ? `${record.dataset.sequenceShape.steps} 个时间步 · ${record.dataset.sequenceShape.channels} 个通道` : `${record.dataset.features[0]?.length ?? 0} 个特征`} · {new Date(record.createdAt).toLocaleString('zh-CN')}</p>{stopped && <p role="status">训练已停止，未生成最终模型或指标。已保留 {record.snapshots.length} 个训练快照。</p>}<h3>训练参数</h3><dl className="experiment-parameters">{Object.entries(record.config).map(([key, value]) => <div key={key}><dt>{formatParameterLabel(key, record.modelKind)}</dt><dd>{formatParameterValue(key, value)}</dd></div>)}</dl>{!stopped && <ExperimentResultPanel record={record} predict={(point) => predictionLabel(record.modelKind, record.model, point)} />}</section>
}

function anchorDownload(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

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
import { saveExperiment, exportExperiments, importExperiments, deleteExperiment } from './features/persistence/persistence'
import { HistoryPage, TopLevelNavigation, type TopLevelPage } from './features/workbench/HistoryPage'
import { DatasetPage } from './features/workbench/pages'
import type { DatasetImportState } from './features/datasets/DatasetPanel'
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
  const [topPage, setTopPage] = useState<TopLevelPage>('dataset')
  const [persistenceNotice, setPersistenceNotice] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [datasetConfirmed, setDatasetConfirmed] = useState(false)
  const [datasetImportState, setDatasetImportState] = useState<DatasetImportState>({ pending: false, error: '' })
  const [parametersValid, setParametersValid] = useState(true)
  const [selectedStep, setSelectedStep] = useState<number>()
  const [visualLayers, setVisualLayers] = useState(defaultVisualLayers)
  useEffect(() => { if (typeof indexedDB !== 'undefined') void useWorkbenchStore.getState().loadExperiments().catch(error => setHistoryError(error instanceof Error ? error.message : '历史记录加载失败')) }, [])
  const abortRef = useRef<AbortController | null>(null)
  const workerClientRef = useRef<ReturnType<typeof createTrainInWorkerClient> | null>(null)
  const stopRequestedRef = useRef(false)
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
    setTraining({ status: '准备训练', progress: 0, snapshots: [], error: undefined, metrics: undefined })
    try {
      const kind = modelConfig.kind
      const effectiveParams = { ...defaultParameters(kind), ...modelConfig.params }
      const totalUpdates = effectiveParams.iterations ?? effectiveParams.epochs
      const trainer = trainers[kind] as any
      const snapshots: any[] = []
      const mlpParams = kind === 'mlp' ? { ...modelConfig.params, hiddenLayers: Array.from({ length: modelConfig.params.hiddenLayerCount ?? 2 }, () => modelConfig.params.hiddenUnits ?? 16) } : {}
      const cnnParams = kind === 'visual-cnn' ? { layers: visualLayers, imageShape: dataset.imageShape } : {}
      const config = { kind, samples: dataset.features, labels: dataset.labels, ...effectiveParams, ...mlpParams, ...cnnParams } as WorkerTrainConfig
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
      setTraining({ status: '初始化模型' })
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      setTraining({ status: '训练中…' })
      const result = typeof Worker === 'undefined'
        ? await runTrainingInHandler(config, onSnapshot, () => controller.signal.aborted)
        : await (workerClientRef.current = createTrainInWorkerClient()).trainInWorker(config, onSnapshot, controller.signal, paused => setTraining({ status: paused ? '训练已暂停' : '训练中…' }))
      if (controller.signal.aborted || abortRef.current !== controller) return
      flushSnapshot()
      const predictions = trainer.predict(result.model, dataset.features)
      if (predictions.flat().some((value: unknown) => typeof value === 'number' && !Number.isFinite(value))) throw new Error('训练数值不稳定，请降低学习率或标准化特征。')
      const metrics = modelTask[kind] === 'classification' ? classificationMetrics(dataset.labels, predictions) : undefined
      const record = { id: String(Date.now()), createdAt: Date.now(), dataset, modelKind: kind, config: { ...effectiveParams, ...mlpParams, ...cnnParams }, metrics, snapshots: result.snapshots, model: result.model, predictions }
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
  const stopTraining = () => { stopRequestedRef.current = true; workerClientRef.current?.sendControl('stop'); abortRef.current?.abort(); setTraining({ status: '训练已停止', error: undefined }); setCurrentExperimentId(undefined) }
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

  const handleTopPageChange = (page: TopLevelPage) => {
    if (page === 'workflow' && !datasetConfirmed) return
    if (page === 'dataset' && ['训练中…', '训练已暂停'].includes(training.status)) return
    setTopPage(page)
  }

  const records = experiments.map((record) => ({ id: record.id, datasetName: record.dataset.name ?? '未命名数据集', model: modelNames[record.modelKind], timestamp: new Date(record.createdAt).toLocaleString('zh-CN'), summary: experimentSummary(record), metrics: record.metrics ?? {} }))
  const explanationPanel = modelConfig.kind ? <ModelExplanationPanel kind={modelConfig.kind} model={currentExperiment?.model} snapshots={training.snapshots} selectedStep={training.status === '训练中…' ? undefined : selectedStep} onStepChange={setSelectedStep} status={training.status} dimensions={dataset.features[0]?.length} /> : undefined
  return <main className="app-shell">
    <header className="app-header"><div className="brand-lockup"><div className="brand-mark">✦</div><div><p className="eyebrow">浏览器机器学习实验</p><h1>机器学习实验工作台</h1><p className="header-subtitle">先选择数据，再观察训练并理解模型。</p></div></div><div className="header-meta"><span className="live-dot" /><span>浏览器端运行</span><span className="status-badge">实验版</span></div></header>
    <TopLevelNavigation activePage={topPage} configurationDisabled={['训练中…', '训练已暂停'].includes(training.status)} workflowDisabled={!datasetConfirmed} onPageChange={handleTopPageChange} />
    <section className="app-content">{topPage === 'dataset' ? <DatasetPage initialDataset={dataset} importState={datasetImportState} onImportStateChange={handleImportStateChange} onDatasetChange={handleDatasetChange} onValidityChange={(valid) => { if (!valid) setDatasetConfirmed(false) }} onError={(message) => setTraining({ status: '数据集错误', error: message })} onContinue={() => { if (datasetImportState.pending || datasetImportState.error) return; setDatasetConfirmed(true); setTopPage('workflow') }} /> : topPage === 'workflow' ? <SinglePageWorkbench
      dataset={dataset} visualLayers={visualLayers} onVisualLayersChange={layers => { invalidateConfiguration(); setVisualLayers(layers) }} model={modelConfig.kind} params={modelConfig.params} datasetName={dataset.name} status={training.status} snapshots={training.snapshots}
      onDatasetChange={handleDatasetChange} onChangeDataset={() => setTopPage('dataset')} onDatasetError={(message) => setTraining({ status: '数据集错误', error: message })}
      parametersValid={parametersValid} onParamsValidityChange={valid => { setParametersValid(valid); if (!valid) invalidateConfiguration() }}
      onModelChange={(kind) => { resetTraining(); setParametersValid(true); setModelConfig({ kind, params: defaults[kind] }) }} onParamsChange={(params) => { invalidateConfiguration(); setModelConfig({ params }) }}
      onStartTraining={runTraining} onPauseTraining={pauseTraining} onStepTraining={stepTraining} onResumeTraining={resumeTraining} onStopTraining={stopTraining} onResetTraining={resetTraining}
      explanation={explanationPanel} resultPanel={currentExperiment ? <ExperimentResultPanel record={currentExperiment} predict={(point) => predictionLabel(currentExperiment.modelKind, currentExperiment.model, point)} /> : undefined} error={training.error}
    /> : <HistoryPage records={records} selectedId={historySelectedId} onSelect={(item) => setHistorySelectedId(item.id)} selectedDetail={historySelected ? <ExperimentDetail record={historySelected} /> : undefined} importError={historyError || persistenceNotice} onExport={async () => { const json = await exportExperiments(useWorkbenchStore.getState().experiments); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'web-deep-learning-experiments.json'; anchor.click(); URL.revokeObjectURL(url) }} onImport={async (file: File) => { try { const records = await importExperiments(await file.text()); useWorkbenchStore.getState().mergeExperiments(records); setHistoryError('') } catch (error) { setHistoryError(error instanceof Error ? error.message : '导入失败') } }} onDelete={() => { if (!historySelectedId) return; const id = historySelectedId; void Promise.resolve(deleteExperiment(id)).then(() => { useWorkbenchStore.getState().removeExperiment(id); setHistorySelectedId(undefined) }).catch(() => setHistoryError('删除失败：本地存储不可用')) }} />}</section>
  </main>
}

function ExperimentDetail({ record }: { record: ReturnType<typeof useWorkbenchStore.getState>['experiments'][number] }) {
  return <section className="result-detail workbench-page-card"><h2>{modelNames[record.modelKind]} · {record.dataset.name ?? '数据集'}</h2><h3>训练参数</h3><dl className="experiment-parameters">{Object.entries(record.config).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl><ExperimentResultPanel record={record} predict={(point) => predictionLabel(record.modelKind, record.model, point)} /></section>
}

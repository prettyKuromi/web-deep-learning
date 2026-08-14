import { useMemo, useRef, useState } from 'react'
import { modelTask, type ModelKind } from './app/workbenchTypes'
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
import { createTrainInWorkerClient, runTrainingInHandler, type WorkerTrainConfig } from './features/training/workerClient'
import { saveExperiment } from './features/persistence/persistence'
import { HistoryPage, TopLevelNavigation, type TopLevelPage } from './features/workbench/HistoryPage'
import { DatasetPage } from './features/workbench/pages'
import { DecisionBoundaryChart } from './features/visualization/DecisionBoundaryChart'
import { SinglePageWorkbench } from './features/workbench/SinglePageWorkbench'
import { ModelExplanationPanel } from './features/visualization/ModelExplanationPanel'
import { normalizeTrainSnapshot } from './features/training/snapshots'
import './App.css'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机', 'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', mlp: '多层感知机（MLP）', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA' }
const defaults: Record<ModelKind, Record<string, number>> = { knn: { k: 5 }, 'logistic-regression': { learningRate: 0.1, iterations: 200, regularization: 0.001 }, 'linear-svm': { learningRate: 0.01, iterations: 200, regularization: 0.001, margin: 1 }, perceptron: { learningRate: 0.1, iterations: 100 }, 'decision-tree': {}, 'random-forest': { trees: 9, maxDepth: 5 }, adaboost: { rounds: 20 }, 'naive-bayes': {}, mlp: { learningRate: 0.01, epochs: 100, batchSize: 32, hiddenLayerCount: 2, hiddenUnits: 16, seed: 42 }, 'linear-regression': {}, 'ridge-regression': {}, 'k-means': { k: 3, iterations: 100 }, dbscan: { epsilon: 0.3, minPoints: 5 }, pca: { components: 2 } }
const createTrainer = (kind: ModelKind) => kind === 'knn' ? createKnnTrainer() : kind === 'logistic-regression' ? createLogisticRegressionTrainer() : kind === 'linear-svm' ? createLinearSvmTrainer() : kind === 'perceptron' ? createPerceptronTrainer() : kind === 'mlp' ? createMlpTrainer() : kind === 'linear-regression' ? createLinearRegressionTrainer() : kind === 'ridge-regression' ? createRidgeRegressionTrainer() : kind === 'k-means' ? createKMeansTrainer() : kind === 'dbscan' ? createDbscanTrainer() : kind === 'pca' ? createPcaTrainer() : kind === 'decision-tree' ? createDecisionTreeTrainer() : kind === 'random-forest' ? createRandomForestTrainer() : kind === 'adaboost' ? createAdaBoostTrainer() : createNaiveBayesTrainer()
const predictionLabel = (kind: ModelKind, model: unknown, point: readonly number[]) => {
  const value = createTrainer(kind).predict(model as never, [point])[0]
  return Array.isArray(value) ? value[0] : value
}

export default function App() {
  const { dataset, setDataset, modelConfig, setModelConfig, training, setTraining, experiments, addExperiment } = useWorkbenchStore()
  const [selectedId, setSelectedId] = useState<string>()
  const [topPage, setTopPage] = useState<TopLevelPage>('dataset')
  const abortRef = useRef<AbortController | null>(null)
  const workerClientRef = useRef<ReturnType<typeof createTrainInWorkerClient> | null>(null)
  const stopRequestedRef = useRef(false)
  const trainers = useMemo(() => Object.fromEntries((Object.keys(defaults) as ModelKind[]).map((kind) => [kind, createTrainer(kind)])) as Record<string, any>, [])
  const selected = experiments.find((record) => record.id === selectedId)

  const runTraining = async () => {
    if (!modelConfig.kind) { setTraining({ status: '等待训练', error: '请先选择模型' }); return }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    stopRequestedRef.current = false
    setTraining({ status: '训练中…', progress: 0, snapshots: [], error: undefined })
    try {
      const kind = modelConfig.kind
      const trainer = trainers[kind] as any
      const snapshots: any[] = []
      const mlpParams = kind === 'mlp' ? { ...modelConfig.params, hiddenLayers: Array.from({ length: modelConfig.params.hiddenLayerCount ?? 2 }, () => modelConfig.params.hiddenUnits ?? 16) } : {}
      const config = { kind, samples: dataset.features, labels: dataset.labels, ...modelConfig.params, ...mlpParams } as WorkerTrainConfig
      const onSnapshot = (snapshot: any) => { const normalized = normalizeTrainSnapshot(snapshot); snapshots.push(normalized); setTraining({ snapshots: [...snapshots], progress: normalized.iteration }) }
      const result = typeof Worker === 'undefined'
        ? await runTrainingInHandler(config, onSnapshot, () => controller.signal.aborted)
        : await (workerClientRef.current = createTrainInWorkerClient()).trainInWorker(config, onSnapshot, controller.signal)
      const predictions = trainer.predict(result.model, dataset.features)
      const metrics = modelTask[kind] === 'classification' ? classificationMetrics(dataset.labels, predictions) : undefined
      const record = { id: String(Date.now()), createdAt: Date.now(), dataset, modelKind: kind, config: modelConfig.params, metrics, snapshots: result.snapshots, model: result.model, predictions }
      addExperiment(record)
      void saveExperiment(record)
      setTraining({ status: '训练完成', progress: 100, snapshots: result.snapshots, metrics })
      setSelectedId(record.id)
    } catch (error) {
      setTraining({ status: stopRequestedRef.current ? '训练已停止' : error instanceof DOMException && error.name === 'AbortError' ? '训练已取消' : '训练失败', error: stopRequestedRef.current ? undefined : error instanceof Error ? error.message : '训练失败' })
    } finally {
      workerClientRef.current = null
    }
  }

  const pauseTraining = () => { workerClientRef.current?.sendControl('pause'); setTraining({ status: '训练已暂停' }) }
  const resumeTraining = () => { workerClientRef.current?.sendControl('resume'); setTraining({ status: '训练中…' }) }
  const stepTraining = () => {
    workerClientRef.current?.sendControl('step')
    const last = training.snapshots.at(-1)
    if (!last) return
    setTraining({ snapshots: [...training.snapshots, { ...last, iteration: last.iteration + 1, step: (last.step ?? last.iteration) + 1 }] })
  }
  const stopTraining = () => { stopRequestedRef.current = true; workerClientRef.current?.sendControl('stop'); abortRef.current?.abort(); setTraining({ status: '训练已停止', error: undefined }) }
  const resetTraining = () => { abortRef.current?.abort(); setSelectedId(undefined); setTraining({ status: '等待训练', progress: 0, snapshots: [], error: undefined, metrics: undefined }) }
  const handleDatasetChange = (nextDataset: typeof dataset) => {
    abortRef.current?.abort()
    setSelectedId(undefined)
    setDataset(nextDataset)
    setTraining({ status: '请重新训练', progress: 0, snapshots: [], error: undefined, metrics: undefined })
  }

  const records = experiments.map((record) => ({ id: record.id, datasetName: record.dataset.name ?? '未命名数据集', model: modelNames[record.modelKind], timestamp: new Date(record.createdAt).toLocaleString('zh-CN'), metrics: record.metrics ?? {} }))
  const explanationPanel = modelConfig.kind ? <ModelExplanationPanel kind={modelConfig.kind} model={selected?.model} snapshots={training.snapshots} dimensions={dataset.features[0]?.length} /> : undefined
  return <main className="app-shell"><header className="app-header"><div className="brand-lockup"><div className="brand-mark">✦</div><div><p className="eyebrow">WEB DEEP LEARNING / WORKBENCH</p><h1>机器学习实验工作台</h1><p className="header-subtitle">先选择数据，再观察训练并理解模型。</p></div></div><div className="header-meta"><span className="live-dot" /><span>浏览器端运行</span><span className="status-badge">MVP 实验版</span></div></header><TopLevelNavigation activePage={topPage} onPageChange={setTopPage} /><section className="app-content">{topPage === 'dataset' ? <DatasetPage onDatasetChange={handleDatasetChange} onError={(message) => setTraining({ status: '数据集错误', error: message })} onContinue={() => setTopPage('workflow')} /> : topPage === 'workflow' ? <SinglePageWorkbench model={modelConfig.kind} params={modelConfig.params} datasetName={dataset.name} status={training.error ? `${training.status}：${training.error}` : training.status} snapshots={training.snapshots} onDatasetChange={handleDatasetChange} onChangeDataset={() => setTopPage('dataset')} onDatasetError={(message) => setTraining({ status: '数据集错误', error: message })} onModelChange={(kind) => { setSelectedId(undefined); setModelConfig({ kind, params: defaults[kind] }) }} onParamsChange={(params) => setModelConfig({ params })} onStartTraining={runTraining} onPauseTraining={pauseTraining} onStepTraining={stepTraining} onResumeTraining={resumeTraining} onStopTraining={stopTraining} onResetTraining={resetTraining} explanation={explanationPanel} currentResult={selected?.metrics && modelConfig.kind && modelTask[modelConfig.kind] === 'classification' ? { dataset: selected.dataset, predictions: selected.predictions, metrics: selected.metrics, predict: (point) => predictionLabel(selected.modelKind, selected.model, point) } : undefined} error={training.error} /> : <HistoryPage records={records} selectedId={selectedId} onSelect={(item) => setSelectedId(item.id)} selectedDetail={selected ? <ExperimentDetail record={selected} /> : undefined} />}</section></main>
}

function ExperimentDetail({ record }: { record: ReturnType<typeof useWorkbenchStore.getState>['experiments'][number] }) {
  return <section className="result-detail workbench-page-card"><h2>{modelNames[record.modelKind]} · {record.dataset.name ?? '数据集'}</h2>{record.metrics ? <><div className="metric-grid">{[['准确率', record.metrics.accuracy], ['Precision', record.metrics.precision], ['Recall', record.metrics.recall], ['F1', record.metrics.f1]].map(([label, value]) => <div key={String(label)}><strong>{Number(value).toFixed(3)}</strong><span>{label}</span></div>)}</div><p className="detail-explanation">准确率是整体预测正确比例，Precision、Recall、F1 是各类别宏平均。</p><div className="matrix-wrap"><h3>混淆矩阵</h3><table><tbody>{record.metrics.confusionMatrix.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table></div><div className="chart-frame"><DecisionBoundaryChart features={record.dataset.features} labels={record.dataset.labels} predictions={record.predictions} predict={(point) => predictionLabel(record.modelKind, record.model, point)} /></div></> : <p>该任务已完成计算，当前结果为无监督或连续值预测结果。</p>}</section>
}

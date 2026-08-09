import { useMemo, useRef, useState } from 'react'
import { modelTask, type ModelKind, workbenchStages } from './app/workbenchTypes'
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
import { StepLabLayout } from './features/workbench/StepLabLayout'
import { DatasetStagePage, ModelStagePage, ResultsStagePage, StepLabPages, TrainingStagePage } from './features/workbench/StepLabPages'
import { HistoryPage, TopLevelNavigation, type TopLevelPage } from './features/workbench/HistoryPage'
import { getStageProgress } from './features/workbench/stageState'
import { DecisionBoundaryChart } from './features/visualization/DecisionBoundaryChart'
import './App.css'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机', 'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', mlp: '多层感知机（MLP）', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA' }
const defaults: Record<ModelKind, Record<string, number>> = { knn: { k: 5 }, 'logistic-regression': { learningRate: 0.1, iterations: 200, regularization: 0.001 }, 'linear-svm': { learningRate: 0.01, iterations: 200, regularization: 0.001, margin: 1 }, perceptron: { learningRate: 0.1, iterations: 100 }, 'decision-tree': {}, 'random-forest': { trees: 9, maxDepth: 5 }, adaboost: { rounds: 20 }, 'naive-bayes': {}, mlp: { learningRate: 0.01, epochs: 100, batchSize: 32, hiddenLayerCount: 2, hiddenUnits: 16, seed: 42 }, 'linear-regression': {}, 'ridge-regression': {}, 'k-means': { k: 3, iterations: 100 }, dbscan: { epsilon: 0.3, minPoints: 5 }, pca: { components: 2 } }
const createTrainer = (kind: ModelKind) => kind === 'knn' ? createKnnTrainer() : kind === 'logistic-regression' ? createLogisticRegressionTrainer() : kind === 'linear-svm' ? createLinearSvmTrainer() : kind === 'perceptron' ? createPerceptronTrainer() : kind === 'mlp' ? createMlpTrainer() : kind === 'linear-regression' ? createLinearRegressionTrainer() : kind === 'ridge-regression' ? createRidgeRegressionTrainer() : kind === 'k-means' ? createKMeansTrainer() : kind === 'dbscan' ? createDbscanTrainer() : kind === 'pca' ? createPcaTrainer() : kind === 'decision-tree' ? createDecisionTreeTrainer() : kind === 'random-forest' ? createRandomForestTrainer() : kind === 'adaboost' ? createAdaBoostTrainer() : createNaiveBayesTrainer()
const predictionLabel = (kind: ModelKind, model: unknown, point: readonly number[]) => {
  const value = createTrainer(kind).predict(model as never, [point])[0]
  return Array.isArray(value) ? value[0] : value
}

export default function App() {
  const { dataset, setDataset, modelConfig, setModelConfig, training, setTraining, experiments, addExperiment, activeStage, setActiveStage } = useWorkbenchStore()
  const [selectedId, setSelectedId] = useState<string>()
  const [topPage, setTopPage] = useState<TopLevelPage>('workflow')
  const abortRef = useRef<AbortController | null>(null)
  const trainers = useMemo(() => Object.fromEntries((Object.keys(defaults) as ModelKind[]).map((kind) => [kind, createTrainer(kind)])) as Record<string, any>, [])
  const selected = experiments.find((record) => record.id === selectedId)
  const stageProgress = getStageProgress({ dataset, modelConfig, training })

  const runTraining = async () => {
    if (!modelConfig.kind) { setTraining({ status: '等待训练', error: '请先选择模型' }); return }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setTraining({ status: '训练中…', progress: 0, snapshots: [], error: undefined })
    try {
      const kind = modelConfig.kind
      const trainer = trainers[kind] as any
      const snapshots: any[] = []
      const mlpParams = kind === 'mlp' ? { ...modelConfig.params, hiddenLayers: Array.from({ length: modelConfig.params.hiddenLayerCount ?? 2 }, () => modelConfig.params.hiddenUnits ?? 16) } : {}
      const config = { kind, samples: dataset.features, labels: dataset.labels, ...modelConfig.params, ...mlpParams } as WorkerTrainConfig
      const onSnapshot = (snapshot: any) => { snapshots.push(snapshot); setTraining({ snapshots: [...snapshots], progress: snapshot.iteration }) }
      const result = typeof Worker === 'undefined'
        ? await runTrainingInHandler(config, onSnapshot, () => controller.signal.aborted)
        : await createTrainInWorkerClient().trainInWorker(config, onSnapshot, controller.signal)
      const predictions = trainer.predict(result.model, dataset.features)
      const metrics = modelTask[kind] === 'classification' ? classificationMetrics(dataset.labels, predictions) : undefined
      const record = { id: String(Date.now()), createdAt: Date.now(), dataset, modelKind: kind, config: modelConfig.params, metrics, snapshots: result.snapshots, model: result.model, predictions }
      addExperiment(record)
      void saveExperiment(record)
      setTraining({ status: '训练完成', progress: 100, snapshots: result.snapshots, metrics })
      setSelectedId(record.id)
    } catch (error) {
      setTraining({ status: error instanceof DOMException && error.name === 'AbortError' ? '训练已取消' : '训练失败', error: error instanceof Error ? error.message : '训练失败' })
    }
  }

  const records = experiments.map((record) => ({ id: record.id, datasetName: record.dataset.name ?? '未命名数据集', model: modelNames[record.modelKind], timestamp: new Date(record.createdAt).toLocaleString('zh-CN'), metrics: record.metrics ?? {} }))
  const pages = {
    数据集: <DatasetStagePage onDatasetChange={setDataset} onError={(message) => setTraining({ status: '数据集错误', error: message })} />,
    模型: <ModelStagePage model={modelConfig.kind} params={modelConfig.params} onModelChange={(kind) => setModelConfig({ kind, params: defaults[kind] })} onParamsChange={(params) => setModelConfig({ params })} />,
    训练: <TrainingStagePage status={training.error ? `${training.status}：${training.error}` : training.status} snapshots={training.snapshots} onTrain={runTraining} disabled={training.status === '训练中…'} currentResult={selected?.metrics && modelTask[selected.modelKind] === 'classification' ? { dataset: selected.dataset, predictions: selected.predictions, metrics: selected.metrics, predict: (point) => predictionLabel(selected.modelKind, selected.model, point) } : undefined} pcaResult={selected?.modelKind === 'pca' ? { model: selected.model as import('./features/training/types').PcaModel, projections: selected.predictions as unknown as readonly (readonly number[])[] } : undefined} />,
    结果: <ResultsStagePage records={records} onSelect={(item) => setSelectedId(item.id)} selectedDetail={selected ? <ExperimentDetail record={selected} /> : undefined} />,
  }
  const workflowStages = workbenchStages.filter((stage) => stage !== '结果')
  const workflowActiveStage = activeStage === '结果' ? '训练' : activeStage
  return <main className="app-shell"><header className="app-header"><div className="brand-lockup"><div className="brand-mark">✦</div><div><p className="eyebrow">WEB DEEP LEARNING / WORKBENCH</p><h1>机器学习实验工作台</h1><p className="header-subtitle">沿着数据、模型和训练三步完成一次可复现实验。</p></div></div><div className="header-meta"><span className="live-dot" /><span>浏览器端运行</span><span className="status-badge">MVP 实验版</span></div></header><TopLevelNavigation activePage={topPage} onPageChange={setTopPage} />{topPage === 'workflow' ? <StepLabLayout activeStage={workflowActiveStage} stages={workflowStages} stageProgress={stageProgress} summary={{ datasetName: dataset.name, sampleCount: dataset.features.length, classCount: new Set(dataset.labels).size, modelName: modelConfig.kind ? modelNames[modelConfig.kind] : undefined, trainingStatus: training.status }} onStageChange={setActiveStage}><StepLabPages activeStage={workflowActiveStage} pages={pages} /></StepLabLayout> : <HistoryPage records={records} onSelect={(item) => setSelectedId(item.id)} selectedDetail={selected ? <ExperimentDetail record={selected} /> : undefined} />}</main>
}

function ExperimentDetail({ record }: { record: ReturnType<typeof useWorkbenchStore.getState>['experiments'][number] }) {
  return <section className="result-detail workbench-page-card"><h2>{modelNames[record.modelKind]} · {record.dataset.name ?? '数据集'}</h2>{record.metrics ? <><div className="metric-grid">{[['准确率', record.metrics.accuracy], ['Precision', record.metrics.precision], ['Recall', record.metrics.recall], ['F1', record.metrics.f1]].map(([label, value]) => <div key={String(label)}><strong>{Number(value).toFixed(3)}</strong><span>{label}</span></div>)}</div><p className="detail-explanation">准确率是整体预测正确比例，Precision、Recall、F1 是各类别宏平均。</p><div className="matrix-wrap"><h3>混淆矩阵</h3><table><tbody>{record.metrics.confusionMatrix.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table></div><div className="chart-frame"><DecisionBoundaryChart features={record.dataset.features} labels={record.dataset.labels} predictions={record.predictions} predict={(point) => predictionLabel(record.modelKind, record.model, point)} /></div></> : <p>该任务已完成计算，当前结果为无监督或连续值预测结果。</p>}</section>
}

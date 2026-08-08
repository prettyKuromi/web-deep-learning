import { useMemo, useRef, useState } from 'react'
import { type ModelKind, workbenchStages } from './app/workbenchTypes'
import { useWorkbenchStore } from './app/workbenchStore'
import { classificationMetrics } from './features/training/metrics'
import { createKnnTrainer } from './features/training/knn'
import { createLinearSvmTrainer } from './features/training/linearSvm'
import { createLogisticRegressionTrainer } from './features/training/logisticRegression'
import { createTrainInWorkerClient, runTrainingInHandler, type WorkerTrainConfig } from './features/training/workerClient'
import { saveExperiment } from './features/persistence/persistence'
import { StepLabLayout } from './features/workbench/StepLabLayout'
import { DatasetStagePage, ModelStagePage, ResultsStagePage, StepLabPages, TrainingStagePage } from './features/workbench/StepLabPages'
import { HistoryPage, TopLevelNavigation, type TopLevelPage } from './features/workbench/HistoryPage'
import { getStageProgress } from './features/workbench/stageState'
import { DecisionBoundaryChart } from './features/visualization/DecisionBoundaryChart'
import './App.css'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM' }
const defaults: Record<ModelKind, Record<string, number>> = { knn: { k: 5 }, 'logistic-regression': { learningRate: 0.1, iterations: 200, regularization: 0.001 }, 'linear-svm': { learningRate: 0.01, iterations: 200, regularization: 0.001, margin: 1 } }

export default function App() {
  const { dataset, setDataset, modelConfig, setModelConfig, training, setTraining, experiments, addExperiment, activeStage, setActiveStage } = useWorkbenchStore()
  const [selectedId, setSelectedId] = useState<string>()
  const [topPage, setTopPage] = useState<TopLevelPage>('workflow')
  const abortRef = useRef<AbortController | null>(null)
  const trainers = useMemo(() => ({ knn: createKnnTrainer(), 'logistic-regression': createLogisticRegressionTrainer(), 'linear-svm': createLinearSvmTrainer() }), [])
  const selected = experiments.find((record) => record.id === selectedId)
  const stageProgress = getStageProgress({ dataset, modelConfig, training })

  const runTraining = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setTraining({ status: '训练中…', progress: 0, snapshots: [], error: undefined })
    try {
      const trainer = trainers[modelConfig.kind] as any
      const snapshots: any[] = []
      const config = { kind: modelConfig.kind, samples: dataset.features, labels: dataset.labels, ...modelConfig.params } as WorkerTrainConfig
      const onSnapshot = (snapshot: any) => { snapshots.push(snapshot); setTraining({ snapshots: [...snapshots], progress: snapshot.iteration }) }
      const result = typeof Worker === 'undefined'
        ? await runTrainingInHandler(config, onSnapshot, () => controller.signal.aborted)
        : await createTrainInWorkerClient().trainInWorker(config, onSnapshot, controller.signal)
      const predictions = trainer.predict(result.model, dataset.features)
      const metrics = classificationMetrics(dataset.labels, predictions)
      const record = { id: String(Date.now()), createdAt: Date.now(), dataset, modelKind: modelConfig.kind, config: modelConfig.params, metrics, snapshots: result.snapshots, model: result.model, predictions }
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
    训练: <TrainingStagePage status={training.error ? `${training.status}：${training.error}` : training.status} snapshots={training.snapshots} onTrain={runTraining} disabled={training.status === '训练中…'} currentResult={selected?.metrics ? { dataset: selected.dataset, predictions: selected.predictions, metrics: selected.metrics, predict: (point) => (selected.modelKind === 'knn' ? createKnnTrainer() : selected.modelKind === 'linear-svm' ? createLinearSvmTrainer() : createLogisticRegressionTrainer()).predict(selected.model as never, [point])[0] } : undefined} />,
    结果: <ResultsStagePage records={records} onSelect={(item) => setSelectedId(item.id)} selectedDetail={selected ? <ExperimentDetail record={selected} /> : undefined} />,
  }
  const workflowStages = workbenchStages.filter((stage) => stage !== '结果')
  const workflowActiveStage = activeStage === '结果' ? '训练' : activeStage
  return <main className="app-shell"><header className="app-header"><div className="brand-lockup"><div className="brand-mark">✦</div><div><p className="eyebrow">WEB DEEP LEARNING / WORKBENCH</p><h1>机器学习实验工作台</h1><p className="header-subtitle">沿着数据、模型和训练三步完成一次可复现实验。</p></div></div><div className="header-meta"><span className="live-dot" /><span>浏览器端运行</span><span className="status-badge">MVP 实验版</span></div></header><TopLevelNavigation activePage={topPage} onPageChange={setTopPage} />{topPage === 'workflow' ? <StepLabLayout activeStage={workflowActiveStage} stages={workflowStages} stageProgress={stageProgress} summary={{ datasetName: dataset.name, sampleCount: dataset.features.length, classCount: new Set(dataset.labels).size, modelName: modelNames[modelConfig.kind], trainingStatus: training.status }} onStageChange={setActiveStage}><StepLabPages activeStage={workflowActiveStage} pages={pages} /></StepLabLayout> : <HistoryPage records={records} onSelect={(item) => setSelectedId(item.id)} selectedDetail={selected ? <ExperimentDetail record={selected} /> : undefined} />}</main>
}

function ExperimentDetail({ record }: { record: ReturnType<typeof useWorkbenchStore.getState>['experiments'][number] }) {
  const trainer = record.modelKind === 'knn' ? createKnnTrainer() : record.modelKind === 'linear-svm' ? createLinearSvmTrainer() : createLogisticRegressionTrainer()
  return <section className="result-detail workbench-page-card"><h2>{modelNames[record.modelKind]} · {record.dataset.name ?? '数据集'}</h2>{record.metrics && <div className="metric-grid">{[['准确率', record.metrics.accuracy], ['Precision', record.metrics.precision], ['Recall', record.metrics.recall], ['F1', record.metrics.f1]].map(([label, value]) => <div key={String(label)}><strong>{Number(value).toFixed(3)}</strong><span>{label}</span></div>)}</div>}<p className="detail-explanation">准确率是整体预测正确比例，Precision、Recall、F1 是各类别宏平均。</p><div className="matrix-wrap"><h3>混淆矩阵</h3>{record.metrics && <table><tbody>{record.metrics.confusionMatrix.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table>}</div><div className="chart-frame"><DecisionBoundaryChart features={record.dataset.features} labels={record.dataset.labels} predictions={record.predictions} predict={(point) => trainer.predict(record.model as never, [point])[0]} /></div></section>
}

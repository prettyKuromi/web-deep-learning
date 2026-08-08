import { useMemo, useState } from 'react'
import { type ModelKind } from './app/workbenchTypes'
import { useWorkbenchStore } from './app/workbenchStore'
import { DatasetPanel } from './features/datasets/DatasetPanel'
import type { Dataset } from './features/datasets/dataset'
import { classificationMetrics } from './features/training/metrics'
import { createKnnTrainer } from './features/training/knn'
import { createLinearSvmTrainer } from './features/training/linearSvm'
import { createLogisticRegressionTrainer } from './features/training/logisticRegression'
import { ModelParameterPanel } from './features/training/ModelParameterPanel'
import { TrainingProgressChart } from './features/training/TrainingProgressChart'
import type { Trainer } from './features/training/types'
import { DecisionBoundaryChart } from './features/visualization/DecisionBoundaryChart'
import { ResultsPage, type ExperimentRecord as PageExperimentRecord } from './features/workbench/pages'
import './App.css'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM' }
const defaults: Record<ModelKind, Record<string, number>> = { knn: { k: 5 }, 'logistic-regression': { learningRate: 0.1, iterations: 200, regularization: 0.001 }, 'linear-svm': { learningRate: 0.01, iterations: 200, regularization: 0.001, margin: 1 } }

export default function App() {
  const { dataset, setDataset, modelConfig, setModelConfig, training, setTraining, experiments, addExperiment } = useWorkbenchStore()
  const [selectedId, setSelectedId] = useState<string>()
  const trainers = useMemo(() => ({ knn: createKnnTrainer(), 'logistic-regression': createLogisticRegressionTrainer(), 'linear-svm': createLinearSvmTrainer() }), [])
  const selected = experiments.find((record) => record.id === selectedId)
  const runTraining = async () => {
    setTraining({ status: '训练中…', progress: 0, snapshots: [], error: undefined })
    try {
      const trainer = trainers[modelConfig.kind] as Trainer<any, any>
      const snapshots: any[] = []
      const result = await trainer.train({ samples: dataset.features, labels: dataset.labels, ...modelConfig.params }, (snapshot) => { snapshots.push(snapshot); setTraining({ snapshots: [...snapshots], progress: snapshot.iteration }) })
      const predictions = trainer.predict(result.model, dataset.features)
      const metrics = classificationMetrics(dataset.labels, predictions)
      const record = { id: String(Date.now()), createdAt: Date.now(), dataset, modelKind: modelConfig.kind, config: modelConfig.params, metrics, snapshots: result.snapshots, model: result.model, predictions }
      addExperiment(record); setTraining({ status: '训练完成', progress: 100, snapshots: result.snapshots, metrics }); setSelectedId(record.id)
    } catch (error) { setTraining({ status: '训练失败', error: error instanceof Error ? error.message : '训练失败' }) }
  }
  const records: PageExperimentRecord[] = experiments.map((record) => ({ id: record.id, datasetName: record.dataset.name ?? '未命名数据集', model: modelNames[record.modelKind], timestamp: new Date(record.createdAt).toLocaleString('zh-CN'), metrics: record.metrics ?? {} }))
  return <main className="app-shell"><header className="app-header"><div className="brand-lockup"><div className="brand-mark">✦</div><div><p className="eyebrow">WEB DEEP LEARNING / WORKBENCH</p><h1>机器学习实验工作台</h1><p className="header-subtitle">选择数据、调整参数、观察训练过程并理解分类结果。</p></div></div><div className="header-meta"><span className="live-dot" /><span>浏览器端运行</span><span className="status-badge">MVP 实验版</span></div></header><section className="single-page-grid"><section className="workbench-page-card"><p className="eyebrow">DATASET</p><h2>选择数据集</h2><DatasetPanel onDatasetChange={(next: Dataset) => setDataset(next)} onError={(message) => setTraining({ status: '数据集错误', error: message })} /></section><section className="workbench-page-card"><p className="eyebrow">MODEL</p><h2>选择模型与参数</h2><div className="model-options compact-models" role="radiogroup" aria-label="模型类型">{(Object.keys(modelNames) as ModelKind[]).map((kind) => <label className={`model-option ${modelConfig.kind === kind ? 'selected' : ''}`} key={kind}><input aria-label={modelNames[kind]} type="radio" name="model" checked={modelConfig.kind === kind} onChange={() => setModelConfig({ kind, params: defaults[kind] })} /><span><strong>{modelNames[kind]}</strong></span></label>)}</div><ModelParameterPanel model={modelConfig.kind} value={modelConfig.params} onChange={(params) => setModelConfig({ params })} /></section><section className="workbench-page-card"><p className="eyebrow">TRAINING</p><h2>训练过程</h2><div className="training-summary"><span>{dataset.features.length} 条样本</span><span>{new Set(dataset.labels).size} 个类别</span><span>{modelNames[modelConfig.kind]}</span></div><div className="training-status-large" role="status">{training.error ? `${training.status}：${training.error}` : training.status}</div><button className="primary-button" type="button" onClick={runTraining}>开始训练 <span aria-hidden="true">→</span></button><div className="chart-frame progress-chart"><TrainingProgressChart snapshots={training.snapshots} /></div></section><section className="workbench-page-card"><p className="eyebrow">RESULTS</p><h2>实验结果</h2><ResultsPage records={records} onSelect={(item) => setSelectedId(item.id)} />{selected && <ExperimentDetail record={selected} />}</section></section></main>
}

function ExperimentDetail({ record }: { record: ReturnType<typeof useWorkbenchStore.getState>['experiments'][number] }) {
  const trainer = record.modelKind === 'knn' ? createKnnTrainer() : record.modelKind === 'linear-svm' ? createLinearSvmTrainer() : createLogisticRegressionTrainer()
  return <section className="result-detail workbench-page-card"><div className="card-heading"><div><p className="eyebrow">EXPERIMENT DETAIL</p><h2>{modelNames[record.modelKind]} · {record.dataset.name ?? '数据集'}</h2></div></div>{record.metrics && <div className="metric-grid">{[['准确率', record.metrics.accuracy], ['Precision', record.metrics.precision], ['Recall', record.metrics.recall], ['F1', record.metrics.f1]].map(([label, value]) => <div key={String(label)}><strong>{Number(value).toFixed(3)}</strong><span>{label}</span></div>)}</div>}<p className="detail-explanation">准确率是整体预测正确比例，Precision、Recall、F1 是各类别宏平均。混淆矩阵按真实类别 × 预测类别排列。</p><div className="matrix-wrap"><h3>混淆矩阵</h3>{record.metrics && <table><tbody>{record.metrics.confusionMatrix.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table>}</div><div className="chart-frame"><DecisionBoundaryChart features={record.dataset.features} labels={record.dataset.labels} predictions={record.predictions} predict={(point) => trainer.predict(record.model as never, [point])[0]} /></div></section>
}

import { useEffect, useMemo, useState } from 'react'
import { workbenchStages, type ModelKind } from './app/workbenchTypes'
import { useWorkbenchStore } from './app/workbenchStore'
import { classificationMetrics } from './features/training/metrics'
import { createKnnTrainer } from './features/training/knn'
import { createLinearSvmTrainer } from './features/training/linearSvm'
import { createLogisticRegressionTrainer } from './features/training/logisticRegression'
import type { Trainer } from './features/training/types'
import { DecisionBoundaryChart } from './features/visualization/DecisionBoundaryChart'
import { DatasetPage, ModelPage, ResultsPage, TrainingPage, type ExperimentRecord as PageExperimentRecord } from './features/workbench/pages'
import type { Dataset } from './features/datasets/dataset'
import './App.css'

const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM' }

function App() {
  const { activeStage, setActiveStage, dataset, setDataset, modelConfig, setModelConfig, training, setTraining, experiments, addExperiment } = useWorkbenchStore()
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>()
  const trainers = useMemo(() => ({ knn: createKnnTrainer(), 'logistic-regression': createLogisticRegressionTrainer(), 'linear-svm': createLinearSvmTrainer() }), [])
  const selectedExperiment = experiments.find((item) => item.id === selectedExperimentId)

  useEffect(() => {
    setActiveStage('数据集')
  }, [setActiveStage])

  const handleDatasetChange = (next: Dataset) => setDataset(next)
  const runTraining = async () => {
    setTraining({ status: '训练中…', progress: 0, snapshots: [], error: undefined })
    try {
      const trainer = trainers[modelConfig.kind] as Trainer<any, any>
      const result = await trainer.train({ samples: dataset.features, labels: dataset.labels, ...modelConfig.params }, (snapshot) => {
        setTraining({ progress: snapshot.iteration, snapshots: [...useWorkbenchStore.getState().training.snapshots, snapshot] })
      })
      const predictions = trainer.predict(result.model, dataset.features)
      const metrics = classificationMetrics(dataset.labels, predictions)
      const record = { id: `${Date.now()}`, createdAt: Date.now(), dataset, modelKind: modelConfig.kind, config: modelConfig.params, metrics, snapshots: result.snapshots, model: result.model, predictions }
      addExperiment(record)
      setTraining({ status: '训练完成', progress: 100, snapshots: result.snapshots, metrics })
      setSelectedExperimentId(record.id)
      setActiveStage('结果')
    } catch (error) {
      setTraining({ status: '训练失败', error: error instanceof Error ? error.message : '训练失败' })
    }
  }

  const pageRecords: PageExperimentRecord[] = experiments.map((record) => ({ id: record.id, datasetName: record.dataset.name ?? '未命名数据集', model: modelNames[record.modelKind], timestamp: new Date(record.createdAt).toLocaleString('zh-CN'), metrics: record.metrics ?? {} }))

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">✦</div><div><p className="eyebrow">WEB DEEP LEARNING / WORKBENCH</p><h1>机器学习实验工作台</h1><p className="header-subtitle">在浏览器中选择数据、训练模型，并理解每一次分类实验。</p></div></div>
        <div className="header-meta"><span className="live-dot" /> <span>浏览器端运行</span><span className="status-badge">MVP 实验版</span></div>
      </header>
      <nav className="stage-nav" aria-label="实验流程">
        <div className="workflow-label"><span className="eyebrow">EXPERIMENT FLOW</span><span className="flow-index">{String(workbenchStages.indexOf(activeStage) + 1).padStart(2, '0')} / 04</span></div>
        {workbenchStages.map((stage, index) => <button className={activeStage === stage ? 'stage-button active' : 'stage-button'} key={stage} type="button" onClick={() => setActiveStage(stage)}><span className="stage-number">{String(index + 1).padStart(2, '0')}</span><span className="stage-name">{stage}</span><span className="stage-caption">{['选择输入数据', '配置分类器', '运行实验过程', '观察模型表现'][index]}</span></button>)}
      </nav>
      <section className="page-container">
        {activeStage === '数据集' && <><DatasetPage onDatasetChange={handleDatasetChange} onError={(message) => setTraining({ status: '数据集错误', error: message })} /><button className="secondary-button" type="button" onClick={() => { setActiveStage('训练'); void runTraining() }}>训练 KNN</button></>}
        {activeStage === '模型' && <ModelPage value={modelConfig.kind} onChange={(kind) => setModelConfig({ kind })} />}
        {activeStage === '训练' && <TrainingPage status={training.error ? `${training.status}：${training.error}` : training.status} onTrain={runTraining}>
          <div className="training-summary"><span>数据集：{dataset.name ?? '未命名'}（{dataset.features.length} 条样本）</span><span>模型：{modelNames[modelConfig.kind]}</span><span>类别数：{new Set(dataset.labels).size}</span></div>
          <div className="training-log">{training.snapshots.length ? training.snapshots.map((snapshot) => <p key={snapshot.iteration}>第 {snapshot.iteration} 步：损失 {snapshot.loss == null ? '—' : snapshot.loss.toFixed(4)}</p>) : <p>点击“开始训练”后，这里会显示训练过程。</p>}</div>
        </TrainingPage>}
        {activeStage === '结果' && <>
          <div className="training-status-large" role="status">{training.status}</div>
          <ResultsPage records={pageRecords} onSelect={(record) => setSelectedExperimentId(record.id)} />
          {selectedExperiment && <ExperimentDetail record={selectedExperiment} />}
        </>}
      </section>
    </main>
  )
}

function ExperimentDetail({ record }: { record: NonNullable<ReturnType<typeof useWorkbenchStore.getState>['experiments']>[number] }) {
  const trainer = record.modelKind === 'knn' ? createKnnTrainer() : record.modelKind === 'linear-svm' ? createLinearSvmTrainer() : createLogisticRegressionTrainer()
  return <section className="result-detail workbench-page-card"><div className="card-heading"><div><p className="eyebrow">EXPERIMENT DETAIL</p><h2>{modelNames[record.modelKind]} · {record.dataset.name ?? '数据集'}</h2></div><span className="model-chip">{record.metrics ? `${(record.metrics.accuracy * 100).toFixed(1)}% 准确率` : '无指标'}</span></div><p className="detail-explanation">准确率表示整体预测正确的比例；Precision、Recall 和 F1 是各类别表现的宏平均。混淆矩阵按“真实类别 × 预测类别”排列，对角线越大表示分类越准确。</p>{record.metrics && <div className="metric-grid">{[['准确率', record.metrics.accuracy], ['Precision', record.metrics.precision], ['Recall', record.metrics.recall], ['F1', record.metrics.f1]].map(([label, value]) => <div key={String(label)}><strong>{Number(value).toFixed(3)}</strong><span>{label}</span></div>)}</div>}<div className="matrix-wrap"><h3>混淆矩阵</h3>{record.metrics && <table><tbody>{record.metrics.confusionMatrix.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table>}</div><div className="chart-frame"><DecisionBoundaryChart features={record.dataset.features} labels={record.dataset.labels} predictions={record.predictions} predict={(point) => trainer.predict(record.model as never, [point])[0]} /></div></section>
}

export default App

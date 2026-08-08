import { useMemo, useState } from 'react'
import { workbenchStages } from './app/workbenchTypes'
import { DatasetPanel } from './features/datasets/DatasetPanel'
import { generateBuiltinDataset, type Dataset } from './features/datasets/dataset'
import { DecisionBoundaryChart } from './features/visualization/DecisionBoundaryChart'
import { createKnnTrainer } from './features/training/knn'
import type { KnnModel } from './features/training/types'
import './App.css'

function App() {
  const [activeStage, setActiveStage] = useState(workbenchStages[0])
  const [dataset, setDataset] = useState<Dataset>(() => generateBuiltinDataset('moons', { samples: 120, seed: 7 }))
  const [k, setK] = useState(5)
  const [model, setModel] = useState<KnnModel>()
  const [predictions, setPredictions] = useState<readonly (string | number)[]>()
  const [status, setStatus] = useState('等待训练')

  const trainer = useMemo(() => createKnnTrainer(), [])
  const runTraining = async () => {
    setStatus('训练中…')
    const result = await trainer.train({ samples: dataset.features, labels: dataset.labels, k })
    setModel(result.model)
    setPredictions(trainer.predict(result.model, dataset.features))
    setStatus('训练完成')
    setActiveStage('结果')
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">WEB DEEP LEARNING / WORKBENCH</p><h1>机器学习实验工作台</h1></div>
        <span className="status-badge">MVP 实验版</span>
      </header>
      <nav className="stage-nav" aria-label="实验流程">
        {workbenchStages.map((stage, index) => <button className={activeStage === stage ? 'stage-button active' : 'stage-button'} key={stage} type="button" onClick={() => setActiveStage(stage)}><span>{String(index + 1).padStart(2, '0')}</span>{stage}</button>)}
      </nav>
      <section className="workbench-grid">
        <aside className="control-column">
          <DatasetPanel onDatasetChange={(next) => { setDataset(next); setModel(undefined); setPredictions(undefined); setStatus('等待训练') }} onError={(message) => setStatus(message)} />
          <section className="control-card" aria-labelledby="model-title">
            <p className="eyebrow">MODEL</p><h2 id="model-title">KNN 分类器</h2>
            <label className="parameter-label" htmlFor="knn-k">邻居数量 k</label>
            <input id="knn-k" type="number" min="1" max="25" value={k} onChange={(event) => setK(Math.max(1, Number(event.target.value) || 1))} />
            <button className="primary-button" type="button" onClick={runTraining}>训练 KNN</button>
            <p className="training-status" role="status">{status}</p>
          </section>
        </aside>
        <section className="visual-column" aria-label="训练结果可视化">
          <div className="chart-card"><div className="card-heading"><div><p className="eyebrow">DECISION BOUNDARY</p><h2>数据分布与决策边界</h2></div><span className="sample-count">{dataset.features.length} 个样本</span></div><DecisionBoundaryChart features={dataset.features} labels={dataset.labels} predictions={predictions} predict={model ? (point) => trainer.predict(model, [point])[0] : undefined} /></div>
          <div className="result-card"><p className="eyebrow">EXPERIMENT STATUS</p><h2>{status}</h2><p>{dataset.name ?? '当前数据集'} · KNN · k={k}</p></div>
        </section>
      </section>
    </main>
  )
}

export default App

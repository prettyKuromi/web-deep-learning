import { useState } from 'react'
import { workbenchStages } from './app/workbenchTypes'
import './App.css'

function App() {
  const [activeStage, setActiveStage] = useState(workbenchStages[0])

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">WEB DEEP LEARNING / WORKBENCH</p>
          <h1>机器学习实验工作台</h1>
        </div>
        <span className="status-badge">MVP 设计阶段</span>
      </header>

      <nav className="stage-nav" aria-label="实验流程">
        {workbenchStages.map((stage, index) => (
          <button
            className={activeStage === stage ? 'stage-button active' : 'stage-button'}
            key={stage}
            type="button"
            onClick={() => setActiveStage(stage)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            {stage}
          </button>
        ))}
      </nav>

      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">CURRENT STAGE · {activeStage}</p>
        <h2 id="welcome-title">从数据到模型结果，全部在浏览器中完成</h2>
        <p>
          选择数据集、配置基础模型并观察训练过程。数据集与训练引擎模块正在接入，后续会在这里呈现完整实验闭环。
        </p>
      </section>

      <section className="architecture-grid" aria-label="项目模块">
        {['数据集', '模型训练', '可视化', '实验记录'].map((module, index) => (
          <article className="module-card" key={module}>
            <span className="module-index">0{index + 1}</span>
            <h3>{module}</h3>
            <p>模块规格将在对应 SDD 批准后实现。</p>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App

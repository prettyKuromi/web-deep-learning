import './App.css'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">WEB DEEP LEARNING</p>
          <h1>机器学习实验工作台</h1>
        </div>
        <span className="status-badge">设计阶段</span>
      </header>

      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">MVP WORKBENCH</p>
        <h2 id="welcome-title">从数据到模型结果，全部在浏览器中完成</h2>
        <p>
          项目基础环境已就绪。后续将逐步接入数据集、KNN、逻辑回归、线性 SVM、训练可视化和实验持久化。
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

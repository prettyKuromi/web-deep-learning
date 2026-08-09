import type { ReactNode } from 'react'
import type { WorkbenchStage } from '../../app/workbenchTypes'
import './pages.css'

export type StageStatus = 'pending' | 'active' | 'completed' | 'blocked'
export type StageProgress = Partial<Record<WorkbenchStage, StageStatus>> & Partial<Record<'dataset' | 'model' | 'training' | 'results', StageStatus>>

export interface ExperimentSummary {
  datasetName?: string
  sampleCount?: number
  classCount?: number
  modelName?: string
  trainingStatus?: string
}

export interface StepLabLayoutProps {
  activeStage: WorkbenchStage
  stages: readonly WorkbenchStage[]
  stageProgress?: StageProgress
  summary: ExperimentSummary
  onStageChange: (stage: WorkbenchStage) => void
  children: ReactNode
}

export function StepLabLayout({ activeStage, stages, stageProgress = {}, summary, onStageChange, children }: StepLabLayoutProps) {
  const activeIndex = stages.indexOf(activeStage)
  const previousStage = activeIndex > 0 ? stages[activeIndex - 1] : undefined
  const nextStage = activeIndex >= 0 && activeIndex < stages.length - 1 ? stages[activeIndex + 1] : undefined
  const isBlocked = (stage?: WorkbenchStage) => stage ? stageProgress[stage] === 'blocked' : true

  return <div className="step-lab-layout" data-testid="step-lab-viewport" data-scroll-policy="fixed-shell">
    <nav className="step-lab-rail" aria-label="实验阶段">
      <p className="step-lab-rail-title">实验流程</p>
      <div className="step-lab-steps" role="tablist" aria-orientation="vertical">
        {stages.map((stage, index) => {
          const key = stage === '数据集' ? 'dataset' : stage === '模型' ? 'model' : stage === '训练' ? 'training' : 'results'
          const status = stageProgress[stage] ?? stageProgress[key] ?? (stage === activeStage ? 'active' : 'pending')
          const loading = stage === '训练' && summary.trainingStatus === '训练中…'
          return <button key={stage} type="button" role="tab" aria-selected={activeStage === stage} aria-controls="step-lab-panel" disabled={status === 'blocked'} className={`step-lab-step ${activeStage === stage ? 'active' : ''} status-${status}`} onClick={() => onStageChange(stage)}>
            <span className="step-lab-step-index">{String(index + 1).padStart(2, '0')}</span><span>{stage}</span><span className={`step-lab-step-status${loading ? ' is-loading' : ''}`} aria-label={loading ? '训练中' : undefined} aria-hidden={loading ? undefined : true}>{loading ? '◌' : status === 'completed' ? '✓' : status === 'blocked' ? '×' : ''}</span>
          </button>
        })}
      </div>
    </nav>

    <main id="step-lab-panel" className="step-lab-main" role="main" aria-label={activeStage}>
      <div className="step-lab-content" data-testid="step-lab-scroll" data-scroll-container="main">{children}</div>
      <footer className="step-lab-actions">
        <button type="button" className="secondary-button" onClick={() => previousStage && onStageChange(previousStage)} disabled={!previousStage}>上一步</button>
        {nextStage ? <button type="button" className="primary-button" onClick={() => onStageChange(nextStage)} disabled={isBlocked(nextStage)}>下一步 <span aria-hidden="true">→</span></button> : null}
      </footer>
    </main>

    <aside className="step-lab-summary" aria-label="实验摘要">
      <p className="eyebrow">EXPERIMENT</p><h2>实验摘要</h2>
      <dl>
        <div><dt>数据集</dt><dd>{summary.datasetName || '未选择'}</dd></div>
        <div><dt>样本数</dt><dd>{summary.sampleCount ?? '—'}</dd></div>
        <div><dt>类别数</dt><dd>{summary.classCount ?? '—'}</dd></div>
        <div><dt>模型</dt><dd>{summary.modelName || '未选择'}</dd></div>
        <div><dt>训练状态</dt><dd>{summary.trainingStatus || '未开始'}</dd></div>
      </dl>
    </aside>
  </div>
}

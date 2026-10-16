import type { ReactNode } from 'react'
import type { ModelKind } from '../../app/workbenchTypes'
import type { TrainSnapshot } from '../training/types'
import { TrainingProgressChart } from '../training/TrainingProgressChart'
import { createModelExplanation } from './modelExplanations'
import './ModelExplanationPanel.css'

export interface ModelExplanationPanelProps {
  kind: ModelKind
  model?: unknown
  snapshots?: readonly TrainSnapshot[]
  selectedStep?: number
  onStepChange?: (step: number) => void
  dimensions?: number
  status?: string
}

export function ModelExplanationPanel({ kind, model, snapshots = [], selectedStep, onStepChange, dimensions, status }: ModelExplanationPanelProps) {
  const explanation = createModelExplanation(kind, model)
  const steps = snapshots.map((snapshot) => snapshot.step ?? snapshot.iteration)
  const currentStep = selectedStep != null && steps.includes(selectedStep) ? selectedStep : steps.at(-1)
  const currentSnapshot = snapshots.find((snapshot) => (snapshot.step ?? snapshot.iteration) === currentStep)
  const visualization = explanation.visualization

  return (
    <section className="model-explanation-panel" aria-labelledby="model-explanation-title">
      <div className="model-explanation-header">
        <div>
          <h3 id="model-explanation-title">{explanation.title}</h3>
          <p>{explanation.description}</p>
        </div>
        {steps.length > 0 && (
          <label>
            训练步骤
            <select aria-label="训练步骤" value={currentStep ?? ''} disabled={!onStepChange || status === '训练中…'} onChange={(event) => onStepChange?.(Number(event.target.value))}>
              {steps.map((step) => <option key={step} value={step}>{step}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="model-explanation-items">
        {explanation.items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </div>

      {explanation.level === 'detailed' ? <DetailedVisualization visualization={visualization} /> : <p className="model-explanation-basic">训练过程以时间线和损失曲线呈现，模型内部结构暂不展开。</p>}

      {currentSnapshot && <p className="model-explanation-basic" aria-label="当前快照">{currentStep === 0 ? '拟合快照' : `第 ${currentStep} 步`}{Number.isFinite(currentSnapshot.loss) ? ` · 损失 ${currentSnapshot.loss!.toFixed(4)}` : ''}</p>}
      {currentSnapshot?.explanation && <pre className="snapshot-explanation">{JSON.stringify(currentSnapshot.explanation, null, 2)}</pre>}
      {snapshots.length > 0 && <TrainingProgressChart snapshots={snapshots} status={status} />}
      {(dimensions ?? inferDimensions(model)) > 2 && <p className="projection-notice">当前图表仅展示前两个特征的投影，不代表真实的高维决策边界。</p>}
    </section>
  )
}

function inferDimensions(model: unknown): number {
  if (!model || typeof model !== 'object') return 0
  const value = (model as { dimensions?: unknown }).dimensions
  return typeof value === 'number' ? value : 0
}

function DetailedVisualization({ visualization }: { visualization: Record<string, unknown> }) {
  const type = typeof visualization.type === 'string' ? visualization.type : ''
  switch (type) {
    case 'neural-network': {
      const layers = Array.isArray(visualization.layers) ? visualization.layers : []
      const weights = Array.isArray(visualization.weights) ? visualization.weights : []
      return <div className="network-visualization" aria-label="神经网络结构"><div className="layer-flow">{layers.map((layer, index) => <span key={index} className="network-layer">{String(layer)}<small>{index === 0 ? '输入层' : index === layers.length - 1 ? '输出层' : `隐藏层 ${index}`}</small></span>)}</div><p>激活函数：{String(visualization.activation)}；权重矩阵：{weights.length} 组</p><h4>权重摘要</h4></div>
    }
    case 'linear-boundary': {
      const weights = Array.isArray(visualization.weights) ? visualization.weights : []
      return <div className="linear-visualization"><h4>权重</h4><code>{JSON.stringify(weights)}</code>{visualization.algorithm === 'linear-svm' && <p>间隔通过最大化分类边界到支持向量的距离获得，训练目标包含 hinge loss。</p>}</div>
    }
    case 'tree': return <div className="tree-visualization"><h4>树结构</h4><TreeNodeView node={visualization.tree} /></div>
    case 'forest': return <div className="ensemble-visualization"><h4>树与贡献</h4><p>共 {String(visualization.treeCount ?? 0)} 棵树，通过多数投票汇总预测。</p></div>
    case 'boosting': return <div className="ensemble-visualization"><h4>弱学习器贡献</h4><p>共 {String(visualization.learnerCount ?? 0)} 个弱学习器，按 alpha 加权。</p></div>
    default: return null
  }
}

function TreeNodeView({ node }: { node: unknown }): ReactNode {
  if (!node || typeof node !== 'object') return <span>暂无树结构</span>
  const value = node as { rule?: unknown; left?: unknown; right?: unknown }
  const rule = typeof value.rule === 'string' || typeof value.rule === 'number' ? String(value.rule) : '叶节点'
  const hasChildren = Boolean(value.left || value.right)
  return <div className="tree-node"><span>{rule}</span>{hasChildren && <div className="tree-children"><TreeNodeView node={value.left} /><TreeNodeView node={value.right} /></div>}</div>
}

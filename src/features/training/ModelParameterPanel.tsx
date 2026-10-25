import { useState } from 'react'
import type { ModelKind } from '../../app/workbenchTypes'
import { parameterDefinitions, parameterError, validateParameters, type ParameterDefinition } from './modelParameters'
export interface ModelParameterPanelProps { model: ModelKind; value: Record<string, number>; onChange: (value: Record<string, number>) => void; onValidityChange?: (valid: boolean) => void; disabled?: boolean }

const parameterHelp: Record<string, string> = {
  learningRate: '每次参数更新的步长。',
  iterations: '模型更新参数的总次数。',
  epochs: '完整遍历训练数据的次数。',
  regularization: '限制过大的模型权重，减轻过拟合。',
  margin: '分类边界与样本之间的目标间隔。',
  trees: '集成投票使用的决策树数量。',
  rounds: '依次加入弱分类器的轮数。',
  maxDepth: '限制树的最大层级，值越小模型越简单。',
  minSamplesSplit: '节点至少有这些样本才继续分裂。',
  varianceSmoothing: '给类别方差加上平滑值，避免零方差。',
  batchSize: '每次更新参数时使用的样本数。',
  hiddenLayerCount: '输入与输出层之间的神经网络层数。',
  hiddenUnits: '每个隐藏层包含的神经元数量。',
  hiddenSize: '循环网络内部状态的维度。',
  seed: '固定随机种子可复现初始化和数据抽样。',
  modelDimension: 'Transformer 内部表示的特征维度。',
  attentionHeads: '并行学习不同关系的注意力分支数。',
  feedForwardSize: 'Transformer 前馈层的中间维度。',
  epsilon: '判断两个样本是否邻近的最大距离。',
  minPoints: '邻域内达到此数量时，样本可成为核心点。',
  components: '投影后保留的维度数。',
}

function describeParameter(model: ModelKind, key: string): string {
  if (key === 'k') return model === 'knn'
    ? '较小的 k 更敏感，较大的 k 更平滑。'
    : '希望把数据划分成的组数。'
  return parameterHelp[key] ?? ''
}

export function ModelParameterPanel({ model, value, onChange, onValidityChange, disabled }: ModelParameterPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const params = parameterDefinitions[model]
  const structuralError = model === 'transformer' && !Object.values(errors).some(Boolean) ? validateParameters(model, value) : ''
  const handleChange = (definition: ParameterDefinition, raw: string) => {
    const error = parameterError(definition, raw)
    const nextErrors = { ...errors, [definition.key]: error }
    setDrafts(current => ({ ...current, [definition.key]: raw }))
    setErrors(nextErrors)
    onValidityChange?.(!Object.values(nextErrors).some(Boolean) && (error !== '' || validateParameters(model, { ...value, [definition.key]: Number(raw) }) === ''))
    if (!error) onChange({ ...value, [definition.key]: Number(raw) })
  }
  return <section className="model-parameter-panel" aria-label="模型参数"><h3>模型参数</h3>{model === 'mlp' && <aside role="note" className="model-suitability-notice">MLP 仅适合数值特征分类；样本过少或类别不平衡时需谨慎。</aside>}{model === 'knn' && <p className="single-page-hint">KNN 根据最近邻居的类别投票决定预测结果。</p>}<div data-testid="model-parameter-grid" className="model-parameter-grid model-parameter-grid--compact">
    {params.length === 0 && <p className="empty-state">暂无可配置参数</p>}
    {params.map(definition => { const currentValue = value[definition.key] ?? definition.defaultValue; const error = errors[definition.key]; const help = describeParameter(model, definition.key); const helpId = 'parameter-help-' + definition.key; const errorId = 'parameter-error-' + definition.key; const describedBy = [help ? helpId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined; return <div className="model-parameter-row" data-testid="model-parameter-row" key={definition.key}><div className="parameter-header"><span>{definition.label}</span></div><div className="parameter-inputs"><input disabled={disabled} className="parameter-slider" aria-label={definition.label + '滑动调节'} aria-describedby={describedBy} type="range" min={definition.min} max={definition.max} step={definition.step} value={currentValue} onChange={event => handleChange(definition, event.target.value)} /><input disabled={disabled} aria-label={definition.label} type="number" min={definition.min} max={definition.max} step={definition.step} value={drafts[definition.key] ?? currentValue} onChange={event => handleChange(definition, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} /></div>{help && <small id={helpId} className="parameter-help">{help}</small>}{error && <small id={errorId} role="alert">{error}</small>}</div> })}
  </div>{structuralError && <small role="alert">{structuralError}</small>}</section>
}

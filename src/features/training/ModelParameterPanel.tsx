import { useState } from 'react'
import type { ModelKind } from '../../app/workbenchTypes'
import { parameterDefinitions, parameterError, type ParameterDefinition } from './modelParameters'
export interface ModelParameterPanelProps { model: ModelKind; value: Record<string, number>; onChange: (value: Record<string, number>) => void; onValidityChange?: (valid: boolean) => void; disabled?: boolean }
export function ModelParameterPanel({ model, value, onChange, onValidityChange, disabled }: ModelParameterPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const params = parameterDefinitions[model]
  const handleChange = (definition: ParameterDefinition, raw: string) => {
    const error = parameterError(definition, raw)
    const nextErrors = { ...errors, [definition.key]: error }
    setDrafts(current => ({ ...current, [definition.key]: raw }))
    setErrors(nextErrors)
    onValidityChange?.(!Object.values(nextErrors).some(Boolean))
    if (!error) onChange({ ...value, [definition.key]: Number(raw) })
  }
  return <section className="model-parameter-panel" aria-label="模型参数"><h3>模型参数</h3>{model === 'mlp' && <aside role="note" className="model-suitability-notice">MLP 仅适合数值特征分类；样本过少或类别不平衡时需谨慎。</aside>}{model === 'knn' && <p className="single-page-hint">KNN 由最近的 k 个邻居投票分类。较小的 k 更敏感，较大的 k 更平滑。</p>}<div data-testid="model-parameter-grid" className="model-parameter-grid model-parameter-grid--compact">
    {params.length === 0 && <p className="empty-state">暂无可配置参数</p>}
    {params.map(definition => { const currentValue = value[definition.key] ?? definition.defaultValue; const error = errors[definition.key]; return <div className="model-parameter-row" data-testid="model-parameter-row" key={definition.key}><div className="parameter-header"><span>{definition.label}</span></div><div className="parameter-inputs"><input disabled={disabled} className="parameter-slider" aria-label={definition.label + '滑动调节'} type="range" min={definition.min} max={definition.max} step={definition.step} value={currentValue} onChange={event => handleChange(definition, event.target.value)} /><input disabled={disabled} aria-label={definition.label} type="number" min={definition.min} max={definition.max} step={definition.step} value={drafts[definition.key] ?? currentValue} onChange={event => handleChange(definition, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'parameter-error-' + definition.key : undefined} /></div>{error && <small id={'parameter-error-' + definition.key} role="alert">{error}</small>}</div> })}
  </div></section>
}

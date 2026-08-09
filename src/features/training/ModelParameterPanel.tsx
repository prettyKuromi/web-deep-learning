import { useState } from 'react'

import type { ModelKind } from '../../app/workbenchTypes'
export type ModelParameterModel = ModelKind
export interface ModelParameterPanelProps {
  model: ModelParameterModel
  value: Record<string, number>
  onChange: (value: Record<string, number>) => void
}

interface ParameterDefinition {
  key: string
  label: string
  min: number
  max: number
  step: number
  integer?: boolean
  defaultValue: number
}

const definitions: Record<ModelParameterModel, ParameterDefinition[]> = {
  knn: [{ key: 'k', label: '邻居数（k）', min: 1, max: 99, step: 1, integer: true, defaultValue: 5 }],
  'logistic-regression': [
    { key: 'learningRate', label: '学习率', min: 0.0001, max: 10, step: 0.01, defaultValue: 0.1 },
    { key: 'iterations', label: '迭代次数', min: 1, max: 5000, step: 1, integer: true, defaultValue: 200 },
    { key: 'regularization', label: '正则化强度', min: 0, max: 10, step: 0.001, defaultValue: 0.001 },
  ],
  'linear-svm': [
    { key: 'learningRate', label: '学习率', min: 0.0001, max: 10, step: 0.01, defaultValue: 0.01 },
    { key: 'iterations', label: '迭代次数', min: 1, max: 5000, step: 1, integer: true, defaultValue: 200 },
    { key: 'regularization', label: '正则化强度', min: 0, max: 10, step: 0.001, defaultValue: 0.001 },
    { key: 'margin', label: '间隔', min: 0.0001, max: 10, step: 0.01, defaultValue: 1 },
  ],
  perceptron: [{ key: 'learningRate', label: '学习率', min: 0.0001, max: 1, step: 0.01, defaultValue: 0.1 }, { key: 'iterations', label: '迭代次数', min: 1, max: 5000, step: 1, integer: true, defaultValue: 100 }],
  'decision-tree': [],
  'random-forest': [{ key: 'trees', label: '树数量', min: 1, max: 100, step: 1, integer: true, defaultValue: 9 }, { key: 'maxDepth', label: '最大深度', min: 1, max: 20, step: 1, integer: true, defaultValue: 5 }],
  adaboost: [{ key: 'rounds', label: '弱分类器轮数', min: 1, max: 100, step: 1, integer: true, defaultValue: 20 }],
  'naive-bayes': [],
  'linear-regression': [
    { key: 'learningRate', label: '学习率', min: 0.0001, max: 1, step: 0.01, defaultValue: 0.05 },
    { key: 'iterations', label: '迭代次数', min: 1, max: 5000, step: 1, integer: true, defaultValue: 500 },
  ],
  'ridge-regression': [
    { key: 'learningRate', label: '学习率', min: 0.0001, max: 1, step: 0.01, defaultValue: 0.05 },
    { key: 'iterations', label: '迭代次数', min: 1, max: 5000, step: 1, integer: true, defaultValue: 500 },
    { key: 'regularization', label: '正则化强度', min: 0, max: 10, step: 0.01, defaultValue: 0.01 },
  ],
  'k-means': [{ key: 'k', label: '簇数量（k）', min: 2, max: 20, step: 1, integer: true, defaultValue: 3 }, { key: 'iterations', label: '迭代次数', min: 1, max: 1000, step: 1, integer: true, defaultValue: 100 }],
  dbscan: [{ key: 'epsilon', label: '邻域半径', min: 0.01, max: 10, step: 0.01, defaultValue: 0.3 }, { key: 'minPoints', label: '最小样本数', min: 1, max: 50, step: 1, integer: true, defaultValue: 5 }],
  pca: [{ key: 'components', label: '主成分数量', min: 1, max: 2, step: 1, integer: true, defaultValue: 2 }],
}

function formatRange(definition: ParameterDefinition) {
  const integerText = definition.integer ? '的整数' : ''
  return `${definition.label}应为 ${definition.min} 到 ${definition.max}${integerText ? ` ${integerText}` : ''}`
}

export function ModelParameterPanel({ model, value, onChange }: ModelParameterPanelProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const params = definitions[model]
  const isCompact = model !== 'knn'

  const handleChange = (definition: ParameterDefinition, raw: string) => {
    if (raw.trim() === '') {
      onChange({ ...value, [definition.key]: 0 })
      return
    }
    const next = Number(raw)
    const valid = raw.trim() !== '' && Number.isFinite(next) && next >= definition.min && next <= definition.max && (!definition.integer || Number.isInteger(next))
    if (!valid) {
      setErrors((current) => ({ ...current, [definition.key]: formatRange(definition) }))
      return
    }
    setErrors((current) => {
      const nextErrors = { ...current }
      delete nextErrors[definition.key]
      return nextErrors
    })
    onChange({ ...value, [definition.key]: next })
  }

  return (
    <section className="model-parameter-panel" aria-label="模型参数">
      <h3>模型参数</h3>
      <div
        className={`model-parameter-grid${isCompact ? ' model-parameter-grid--compact' : ''}`}
        data-testid="model-parameter-grid"
      >
        {params.map((definition) => {
          const id = `model-param-${definition.key}`
          const currentValue = value[definition.key] ?? definition.defaultValue
          return (
            <div className="model-parameter-row" data-testid="model-parameter-row" key={definition.key}>
              <div className="parameter-header"><span>{definition.label}</span><output>{currentValue}</output></div>
              <input className="parameter-slider" aria-label={`${definition.label}滑动调节`} type="range" min={definition.min} max={definition.max} step={definition.step} value={currentValue} onChange={(event) => handleChange(definition, event.target.value)} />
              <div className="parameter-scale"><span>{definition.min}</span><div className="exact-input"><span>精确输入</span><input id={id} aria-label={definition.label} type="number" min={definition.min} max={definition.max} step={definition.step} value={currentValue} onChange={(event) => handleChange(definition, event.target.value)} aria-invalid={Boolean(errors[definition.key])} /></div><span>{definition.max}</span></div>
              {errors[definition.key] && <small role="alert">{errors[definition.key]}</small>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

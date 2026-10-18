import { useMemo, useState } from 'react'
import type { Dataset } from '../datasets/dataset'
import type { Label } from '../training/types'

interface PredictionPlaygroundProps {
  dataset: Dataset
  predict: (point: readonly number[]) => Label
  task: 'classification' | 'regression'
  modelName?: string
}

const formatValue = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(3)

export function PredictionPlayground({ dataset, predict, task, modelName }: PredictionPlaygroundProps) {
  const dimension = dataset.features[0]?.length ?? 0
  const defaults = useMemo(() => Array.from({ length: dimension }, (_, index) => {
    const values = dataset.features.map(row => row[index]).filter(Number.isFinite)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  }), [dataset.features, dimension])
  const [values, setValues] = useState<string[]>(() => defaults.map(formatValue))
  const [result, setResult] = useState<Label>()
  const [error, setError] = useState('')

  if (!dimension) return null
  const updateValue = (index: number, value: string) => {
    setValues(current => current.map((item, itemIndex) => itemIndex === index ? value : item))
    setResult(undefined)
    setError('')
  }
  const handlePredict = () => {
    try {
      const point = values.map((value, index) => {
        const parsed = Number(value)
        if (!value.trim() || !Number.isFinite(parsed)) throw new Error(`特征 ${index + 1} 必须是有效数字。`)
        return parsed
      })
      setResult(predict(point))
      setError('')
    } catch (cause) {
      setResult(undefined)
      setError(cause instanceof Error ? cause.message : '预测失败，请检查输入。')
    }
  }
  const reset = () => { setValues(defaults.map(formatValue)); setResult(undefined); setError('') }
  return <section className="prediction-playground" aria-label="交互式预测">
    <div className="prediction-playground__heading"><div><h4>交互式预测</h4><p>输入一条新样本，观察当前模型的真实预测。默认值为数据集各特征均值。</p></div>{modelName && <span className="prediction-playground__model">模型：{modelName}</span>}</div>
    <div className="prediction-playground__inputs">{values.map((value, index) => <label key={index}>特征 {index + 1}<input aria-label={`特征 ${index + 1}`} inputMode="decimal" value={value} onChange={event => updateValue(index, event.target.value)} /></label>)}</div>
    <div className="prediction-playground__actions"><button type="button" className="primary-button" onClick={handlePredict}>运行预测</button><button type="button" onClick={reset}>恢复均值</button></div>
    {error && <p className="single-page-error" role="alert">{error}</p>}
    {result !== undefined && <p className="prediction-playground__result" role="status">预测{task === 'classification' ? '类别' : '值'}：<strong>{String(result)}</strong></p>}
  </section>
}

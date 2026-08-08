import { useState, type ChangeEvent } from 'react'
import { BUILTIN_DATASETS, generateBuiltinDataset, parseCsvDataset, type Dataset, type BuiltinDatasetId } from './dataset'

export interface DatasetPanelProps {
  onDatasetChange: (dataset: Dataset) => void
  onError?: (message: string) => void
}

const displayNames: Record<BuiltinDatasetId, string> = {
  linear: '线性可分',
  xor: 'XOR',
  moons: '月牙形',
  circles: '环形',
  blobs: '随机簇',
}

export function DatasetPanel({ onDatasetChange, onError }: DatasetPanelProps) {
  const [selectedId, setSelectedId] = useState<BuiltinDatasetId>('linear')
  const [summary, setSummary] = useState<{ name: string; count: number; skipped?: number } | null>(null)
  const [error, setError] = useState('')

  const selectBuiltin = (id: BuiltinDatasetId) => {
    setSelectedId(id)
    setError('')
    const dataset = { ...generateBuiltinDataset(id), name: displayNames[id] }
    setSummary({ name: dataset.name ?? displayNames[id], count: dataset.features.length })
    onDatasetChange(dataset)
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = typeof file.text === 'function' ? await file.text() : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('文件读取失败'))
        reader.readAsText(file)
      })
      const result = parseCsvDataset(text)
      const dataset = { ...result.dataset, name: 'CSV 数据集' }
      setSummary({ name: dataset.name, count: dataset.features.length, skipped: result.skippedRows })
      setError('')
      onDatasetChange(dataset)
    } catch {
      const message = 'CSV 无有效数据，至少需要一行有效数据（两个数值特征和非空标签）'
      setError(message)
      onError?.(message)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="dataset-panel" aria-labelledby="dataset-panel-title">
      <div>
        <p className="eyebrow">DATASET</p>
        <h2 id="dataset-panel-title">选择数据集</h2>
      </div>
      <label>
        内置数据集
        <select
          aria-label="内置数据集"
          value={selectedId}
          onChange={(event) => selectBuiltin(event.target.value as BuiltinDatasetId)}
        >
          {BUILTIN_DATASETS.map(({ id }) => (
            <option key={id} value={id}>{displayNames[id]}</option>
          ))}
        </select>
      </label>
      <label className="csv-upload">
        上传 CSV
        <input aria-label="上传 CSV" type="file" accept=".csv,text/csv" onChange={handleFile} />
      </label>
      {summary && <p className="dataset-summary">当前：{summary.name}，{summary.count} 条样本{summary.skipped ? `（跳过 ${summary.skipped} 行）` : ''}</p>}
      {error && <p role="alert" className="dataset-error">{error}</p>}
    </section>
  )
}

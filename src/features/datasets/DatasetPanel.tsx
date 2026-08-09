import { useState, type ChangeEvent } from 'react'
import { BUILTIN_DATASET_METADATA, BUILTIN_DATASETS, createDatasetPreview, generateBuiltinDataset, parseCsvDataset, type Dataset, type BuiltinDatasetId, type DatasetPreview } from './dataset'

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
  const initialDataset = { ...generateBuiltinDataset('linear'), name: displayNames.linear }
  const [preview, setPreview] = useState<DatasetPreview | null>(() => createDatasetPreview(initialDataset))
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(initialDataset)
  const [error, setError] = useState('')

  const selectBuiltin = (id: BuiltinDatasetId) => {
    setSelectedId(id)
    setError('')
    const dataset = { ...generateBuiltinDataset(id), name: displayNames[id] }
    setSummary({ name: dataset.name ?? displayNames[id], count: dataset.features.length })
    setCurrentDataset(dataset)
    setPreview(createDatasetPreview(dataset))
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
      setCurrentDataset(dataset)
      setPreview(createDatasetPreview(dataset))
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
      {currentDataset && preview && <div className="dataset-preview" aria-label="数据集预览">
        <h3>数据集预览</h3>
        <div className="dataset-stats">
          <div><span>样本量</span><strong>{preview.sampleCount}</strong></div>
          <div><span>特征数</span><strong>{preview.featureCount}</strong></div>
          <div><span>标签数</span><strong>{preview.labelCount || '无'}</strong></div>
          <div><span>缺失值</span><strong>{preview.missingCount}</strong></div>
        </div>
        <p className="dataset-description">{currentDataset.name !== 'CSV 数据集' ? BUILTIN_DATASET_METADATA[selectedId]?.description : '用户上传的 CSV 数据集。'}</p>
        <p className="dataset-characteristics">{currentDataset.name !== 'CSV 数据集' ? BUILTIN_DATASET_METADATA[selectedId]?.characteristics : '根据导入数据计算规模、标签分布和特征范围。'}</p>
        <div className="dataset-preview-grid">
          <div><h4>标签分布</h4><ul>{preview.labelDistribution.map(({ label, count }) => <li key={String(label)}>{String(label)}：{count}</li>)}</ul></div>
          <div><h4>特征范围</h4><ul>{preview.featureRanges.map((range, index) => <li key={index}>特征 {index + 1}：{range.min ?? '—'} ~ {range.max ?? '—'}</li>)}</ul></div>
        </div>
        <h4>前 {preview.sampleRows.length} 条有效样本</h4>
        <div className="dataset-table-wrap"><table><thead><tr><th>#</th><th>特征 1</th><th>特征 2</th><th>标签</th></tr></thead><tbody>{preview.sampleRows.map((row) => <tr key={row.index}><td>{row.index + 1}</td><td>{row.features[0]}</td><td>{row.features[1]}</td><td>{row.label ?? '—'}</td></tr>)}</tbody></table></div>
      </div>}
      {error && <p role="alert" className="dataset-error">{error}</p>}
    </section>
  )
}

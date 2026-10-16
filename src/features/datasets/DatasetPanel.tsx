import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { BUILTIN_DATASET_METADATA, BUILTIN_DATASETS, createDatasetPreview, generateBuiltinDataset, parseCsvDataset, type Dataset, type BuiltinDatasetId } from './dataset'
import { isModelCompatible, modelGroups, type ModelKind } from '../../app/workbenchTypes'

export interface DatasetImportState { pending: boolean; error: string }

export interface DatasetPanelProps {
  onDatasetChange: (dataset: Dataset) => void
  onError?: (message: string) => void
  onValidityChange?: (valid: boolean) => void
  action?: ReactNode | ((valid: boolean) => ReactNode)
  initialDataset?: Dataset
  importState?: DatasetImportState
  onImportStateChange?: (state: DatasetImportState) => void
}

export function DatasetPanel({ onDatasetChange, onError, onValidityChange, action, initialDataset, importState, onImportStateChange }: DatasetPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importRequestRef = useRef(0)
  const importPendingRef = useRef(false)
  const [currentDataset, setCurrentDataset] = useState(() => initialDataset ?? generateBuiltinDataset('linear'))
  const [skippedRows, setSkippedRows] = useState(0)
  const [localImportState, setLocalImportState] = useState<DatasetImportState>({ pending: false, error: '' })
  const { pending: isImporting, error } = importState ?? localImportState
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const preview = useMemo(() => createDatasetPreview(currentDataset), [currentDataset])
  const selectedId = BUILTIN_DATASETS.find(({ name }) => name === currentDataset.name)?.id
  const valid = !error && !isImporting
  useEffect(() => () => {
    importRequestRef.current += 1
    if (importPendingRef.current) onImportStateChange?.({ pending: false, error: 'CSV 导入已中断，请重新导入或选择内置数据集。' })
  }, [onImportStateChange])
  const updateImportState = (state: DatasetImportState) => {
    importPendingRef.current = state.pending
    setLocalImportState(state)
    onImportStateChange?.(state)
  }
  const warnings = [
    preview.featureCount > 2 && '高维数据的二维投影仅用于观察，不代表真实决策边界。',
    preview.sampleCount < 30 && '样本量较少，训练和评估结果可能不稳定。',
    preview.labelDistribution.length > 1 && Math.max(...preview.labelDistribution.map((item) => item.count)) / preview.sampleCount >= 0.8 && '类别分布可能不平衡，请同时关注各类别指标。',
    preview.featureRanges.some((range) => (range.max ?? 0) - (range.min ?? 0) > 100) && '特征尺度差异较大，建议使用标准化或归一化。',
  ].filter((warning): warning is string => Boolean(warning))

  const applyDataset = (dataset: Dataset, skipped = 0) => {
    setCurrentDataset(dataset)
    setSkippedRows(skipped)
    updateImportState({ pending: false, error: '' })
    onValidityChange?.(true)
    onDatasetChange(dataset)
  }
  const selectBuiltin = (id: BuiltinDatasetId) => {
    importRequestRef.current += 1
    applyDataset(generateBuiltinDataset(id))
  }
  const importFile = async (file?: File) => {
    if (!file) return
    const request = ++importRequestRef.current
    updateImportState({ pending: true, error: '' })
    onValidityChange?.(false)
    try {
      const text = typeof file.text === 'function' ? await file.text() : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('文件读取失败'))
        reader.readAsText(file)
      })
      if (request !== importRequestRef.current) return
      const result = parseCsvDataset(text)
      applyDataset({ ...result.dataset, name: 'CSV 数据集' }, result.skippedRows)
    } catch {
      if (request !== importRequestRef.current) return
      const message = 'CSV 无有效数据，至少需要一行有效数据（数值特征和非空标签，并包含至少两个类别）'
      updateImportState({ pending: false, error: message })
      onError?.(message)
    }
  }
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    await importFile(event.target.files?.[0])
    event.target.value = ''
  }
  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDraggingFile(false)
    void importFile(event.dataTransfer.files[0])
  }

  return <section className="dataset-panel" aria-labelledby="dataset-panel-title">
    <div className="dataset-controls">
      <div><p className="eyebrow">数据来源</p><h2 id="dataset-panel-title">选择数据集</h2></div>
      <label>内置数据集<select aria-label="内置数据集" value={error ? '' : selectedId ?? 'csv'} onChange={(event) => selectBuiltin(event.target.value as BuiltinDatasetId)}>
        {error && <option value="" disabled>请重新选择有效数据集</option>}
        {!selectedId && <option value="csv" disabled>当前导入的 CSV 数据集</option>}
        {BUILTIN_DATASETS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <div className="csv-upload">
        <input ref={fileInputRef} aria-label="上传 CSV" className="csv-upload-input" type="file" accept=".csv,text/csv" onChange={handleFile} />
        <button type="button" className={`csv-dropzone${isDraggingFile ? ' is-dragging' : ''}`} onClick={() => fileInputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDraggingFile(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDraggingFile(false)} onDrop={handleDrop}>
          <span className="csv-dropzone-icon" aria-hidden="true">⇪</span><span><strong>拖拽 CSV 文件到此处</strong><small>或点击选择文件</small></span>
        </button>
      </div>
      <p className="dataset-summary">当前：{currentDataset.name ?? '未命名数据集'}，{preview.sampleCount} 条样本{skippedRows ? `（跳过 ${skippedRows} 行）` : ''}</p>
      {isImporting && <p className="dataset-summary" role="status">正在读取 CSV…</p>}
      {error && <p role="alert" className="dataset-error">{error}</p>}
      {action && <div className="dataset-actions">{typeof action === 'function' ? action(valid) : action}</div>}
    </div>
    <div className="dataset-preview" aria-label="数据集预览">
      <h3>数据集预览</h3>
      <div className="dataset-stats">
        <div><span>样本量</span><strong>{preview.sampleCount}</strong></div><div><span>特征数</span><strong>{preview.featureCount}</strong></div>
        <div><span>标签数</span><strong>{preview.labelCount || '无'}</strong></div><div><span>缺失值</span><strong>{preview.missingCount}</strong></div>
      </div>
      <p className="dataset-description">{selectedId ? BUILTIN_DATASET_METADATA[selectedId].description : '用户上传的 CSV 数据集。'}</p>
      <p className="dataset-characteristics">{selectedId ? BUILTIN_DATASET_METADATA[selectedId].characteristics : '根据导入数据计算规模、标签分布和特征范围。'}</p>
      {currentDataset.dataType === 'image' && <div className="dataset-image-samples" aria-label="数字图像样本">{currentDataset.features.slice(0, 10).map((pixels, index) => <figure key={index}><div className="dataset-pixel-grid">{pixels.map((value, pixel) => <i key={pixel} style={{ opacity: value }} />)}</div><figcaption>数字 {currentDataset.labels[index]}</figcaption></figure>)}</div>}
      {warnings.length > 0 && <aside className="dataset-advisory" role="note"><strong>数据适用性提醒</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></aside>}
      <details className="dataset-compatibility"><summary>模型适用范围</summary><p>{currentDataset.dataType === 'image' ? '灰度图像数据，适合卷积、池化和全连接层组合。' : '数值表格数据，适合 KNN、线性模型、树模型和 MLP。'}</p><ul>
        <li>适用：{modelKinds.filter((kind) => isModelCompatible(kind, currentDataset).compatible).map((kind) => modelNames[kind]).join('、')}</li>
        <li>不适用：{modelKinds.filter((kind) => !isModelCompatible(kind, currentDataset).compatible).map((kind) => modelNames[kind]).join('、')}</li>
      </ul></details>
      <div className="dataset-preview-grid">
        <div><h4>标签分布</h4><ul>{preview.labelDistribution.map(({ label, count }) => <li key={String(label)}>{String(label)}：{count}</li>)}</ul></div>
        <div><h4>特征范围</h4><ul>{preview.featureRanges.map((range, index) => <li key={index}>特征 {index + 1}：<span title={String(range.min ?? '')}>{formatValue(range.min)}</span> ~ <span title={String(range.max ?? '')}>{formatValue(range.max)}</span></li>)}</ul></div>
      </div>
      <h4>前 {preview.sampleRows.length} 条有效样本</h4>
      <div className="dataset-table-wrap"><table><thead><tr><th>#</th><th>特征 1</th><th>特征 2</th><th>标签</th></tr></thead><tbody>{preview.sampleRows.map((row) => <tr key={row.index}><td>{row.index + 1}</td><td title={String(row.features[0] ?? '')}>{formatValue(row.features[0])}</td><td title={String(row.features[1] ?? '')}>{formatValue(row.features[1])}</td><td>{row.label ?? '—'}</td></tr>)}</tbody></table></div>
    </div>
  </section>
}

const formatValue = (value: number | null | undefined) => value == null ? '—' : String(Number(value.toFixed(4)))
const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机', 'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', mlp: '多层感知机（MLP）', 'visual-cnn': '可视化卷积神经网络', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA' }
const modelKinds = Object.values(modelGroups).flat() as ModelKind[]

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { BUILTIN_DATASET_METADATA, BUILTIN_DATASETS, createDatasetPreview, generateBuiltinDataset, parseCsvDataset, type Dataset, type BuiltinDatasetId } from './dataset'
import { isModelCompatible, modelGroups, type ModelKind } from '../../app/workbenchTypes'
import { profileDataset } from './profiling'

export interface DatasetImportState { pending: boolean; error: string }

export interface DatasetPanelProps {
  controlsBefore?: ReactNode
  onDatasetChange: (dataset: Dataset) => void
  onError?: (message: string) => void
  onValidityChange?: (valid: boolean) => void
  action?: ReactNode | ((valid: boolean) => ReactNode)
  initialDataset?: Dataset
  model?: ModelKind
  importState?: DatasetImportState
  onImportStateChange?: (state: DatasetImportState) => void
}

export function DatasetPanel({ controlsBefore, onDatasetChange, onError, onValidityChange, action, initialDataset, importState, onImportStateChange, model }: DatasetPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importRequestRef = useRef(0)
  const importPendingRef = useRef(false)
  const [currentDataset, setCurrentDataset] = useState(() => initialDataset && (!model || isModelCompatible(model, initialDataset).compatible) ? initialDataset : generateBuiltinDataset(model === 'visual-cnn' ? 'digits' : 'linear'))
  const [skippedRows, setSkippedRows] = useState(0)
  const [localImportState, setLocalImportState] = useState<DatasetImportState>({ pending: false, error: '' })
  const { pending: isImporting, error } = importState ?? localImportState
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  useEffect(() => {
    if (!initialDataset) return
    setCurrentDataset(!model || isModelCompatible(model, initialDataset).compatible
      ? initialDataset
      : generateBuiltinDataset(model === 'visual-cnn' ? 'digits' : 'linear'))
  }, [initialDataset, model])
  const preview = useMemo(() => createDatasetPreview(currentDataset), [currentDataset])
  const profile = useMemo(() => profileDataset(currentDataset), [currentDataset])
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
    preview.featureCount > 2 && currentDataset.dataType !== 'image' && '高维数据的二维投影仅用于观察，不代表真实决策边界。',
    preview.sampleCount < 30 && '样本量较少，训练和评估结果可能不稳定。',
    preview.labelDistribution.length > 1 && Math.max(...preview.labelDistribution.map((item) => item.count)) / preview.sampleCount >= 0.8 && '类别分布可能不平衡，请同时关注各类别指标。',
    preview.featureRanges.some((range) => (range.max ?? 0) - (range.min ?? 0) > 100) && '特征尺度差异较大，建议使用标准化或归一化。',
  ].filter((warning): warning is string => Boolean(warning))
  const profileWarnings = profile.warnings.filter((warning) => currentDataset.dataType !== 'image' && !warnings.some((existing) => warning.startsWith(existing.split('。')[0] ?? '')))

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
  const imageDatasetIds: BuiltinDatasetId[] = ['digits', 'shapes']
  const availableDatasets = BUILTIN_DATASETS.filter(({ id }) => !model || (model === 'visual-cnn' ? imageDatasetIds.includes(id) : !imageDatasetIds.includes(id)))
  const canImportCsv = model !== 'visual-cnn'
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
      {controlsBefore}
      <div><p className="eyebrow">数据来源</p><h2 id="dataset-panel-title">选择数据集</h2></div>
      <label>内置数据集<select aria-label="内置数据集" value={error ? '' : selectedId ?? 'csv'} onChange={(event) => selectBuiltin(event.target.value as BuiltinDatasetId)}>
        {error && <option value="" disabled>请重新选择有效数据集</option>}
        {!selectedId && <option value="csv" disabled>当前导入的 CSV 数据集</option>}
        {availableDatasets.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      {canImportCsv && <div className="csv-upload">
        <input ref={fileInputRef} aria-label="上传 CSV" className="csv-upload-input" type="file" accept=".csv,text/csv" onChange={handleFile} />
        <button type="button" className={`csv-dropzone${isDraggingFile ? ' is-dragging' : ''}`} onClick={() => fileInputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDraggingFile(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDraggingFile(false)} onDrop={handleDrop}>
          <span className="csv-dropzone-icon" aria-hidden="true">⇪</span><span><strong>拖拽 CSV 文件到此处</strong><small>或点击选择文件</small></span>
        </button>
      </div>}
      {canImportCsv ? <p className="dataset-summary">CSV 第一行为表头，最后一列为标签，其余列必须为数值；至少两个类别。聚类与 PCA 当前也需保留标签列，不支持无标签导入或字段映射。</p> : <p className="dataset-summary">当前模型需要带有图像尺寸的图像数据集，请从上方选择。</p>}
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
      {currentDataset.dataType === 'image' && <div className="dataset-image-samples" aria-label="图像样本">{currentDataset.features.slice(0, 8).map((pixels, index) => <figure key={index}><div className="dataset-pixel-grid">{pixels.map((value, pixel) => <i key={pixel} style={{ opacity: value }} />)}</div><figcaption>类别 {currentDataset.labels[index]}</figcaption></figure>)}</div>}
      {(warnings.length > 0 || profileWarnings.length > 0) && <aside className="dataset-advisory" role="note"><strong>数据适用性提醒</strong><ul>{[...warnings, ...profileWarnings].map((warning) => <li key={warning}>{warning}</li>)}</ul></aside>}
      <details className="dataset-compatibility"><summary>模型适用范围</summary><p>{currentDataset.dataType === 'image' ? '灰度图像数据，适合卷积、池化和全连接层组合。' : '数值表格数据，适合 KNN、线性模型、树模型和 MLP。'}</p><ul>
        <li>适用：{modelKinds.filter((kind) => isModelCompatible(kind, currentDataset).compatible).map((kind) => modelNames[kind]).join('、')}</li>
        <li>不适用：{modelKinds.filter((kind) => !isModelCompatible(kind, currentDataset).compatible).map((kind) => modelNames[kind]).join('、')}</li>
      </ul></details>
      <div className="dataset-preview-grid">
        <div><h4>标签分布</h4><ul>{profile.classDistribution.map(({ label, count, ratio }) => <li key={String(label)}><span>{String(label)}：{count}</span>（{formatPercent(ratio)}）</li>)}</ul></div>
        <div><h4>特征统计（全部 {preview.featureCount} 维）</h4><ul>{profile.features.map((feature) => <li key={feature.index}>{feature.name}：均值 {formatValue(feature.mean)}，标准差 {formatValue(feature.standardDeviation)}，范围 <span title={String(feature.min ?? '')}>{formatValue(feature.min)}</span> ~ <span title={String(feature.max ?? '')}>{formatValue(feature.max)}</span>{feature.nonFiniteCount ? `，非有限值 ${feature.nonFiniteCount}` : ''}</li>)}</ul></div>
      </div>
      <h4>前 {preview.sampleRows.length} 条有效样本</h4>
      <div className="dataset-table-wrap"><table aria-label={`前 ${preview.sampleRows.length} 条有效样本`}><thead><tr><th>#</th>{preview.featureRanges.map((_, index) => <th key={index}>{profile.features[index]?.name ?? `特征 ${index + 1}`}</th>)}<th>标签</th></tr></thead><tbody>{preview.sampleRows.map((row) => <tr key={row.index}><td>{row.index + 1}</td>{preview.featureRanges.map((_, index) => <td key={index} title={String(row.features[index] ?? '')}>{formatValue(row.features[index])}</td>)}<td>{row.label ?? '—'}</td></tr>)}</tbody></table></div>
    </div>
  </section>
}

const formatValue = (value: number | null | undefined) => value == null ? '—' : String(Number(value.toFixed(4)))
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`
const modelNames: Record<ModelKind, string> = { knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机', 'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', mlp: '多层感知机（MLP）', 'visual-cnn': '可视化卷积神经网络', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA' }
const modelKinds = Object.values(modelGroups).flat() as ModelKind[]

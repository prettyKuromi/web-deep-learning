import { useRef, useState, type CSSProperties, type DragEvent } from 'react'
import type { ImageShape } from '../datasets/dataset'
import type { TrainSnapshot } from './types'
import { describeVisualNetwork, type VisualActivation, type VisualLayer } from './visualNetwork'
import './NetworkFlowCanvas.css'

type LayerType = VisualLayer['type']
type InsertPosition = { index: number; label: string }

function createLayer(type: LayerType, layers: readonly VisualLayer[]): VisualLayer {
  const prefix = { conv2d: 'conv', 'max-pool': 'pool', dense: 'dense', activation: 'activation', dropout: 'dropout' }[type]
  const ids = new Set(layers.map(layer => layer.id))
  let index = layers.filter(layer => layer.type === type).length + 1
  while (ids.has(`${prefix}-${index}`)) index++
  const id = `${prefix}-${index}`
  if (type === 'conv2d') return { id, type, filters: 8 }
  if (type === 'max-pool') return { id, type }
  if (type === 'dense') return { id, type, units: 32 }
  if (type === 'activation') return { id, type, activation: 'relu' }
  return { id, type, rate: 0.1 }
}

export function NetworkFlowCanvas({ layers, imageShape, status, snapshots, onChange, outputClasses = 10 }: {
  layers: VisualLayer[]
  imageShape: ImageShape
  status: string
  snapshots: readonly TrainSnapshot[]
  onChange?: (layers: VisualLayer[]) => void
  outputClasses?: number
}) {
  const [insertPosition, setInsertPosition] = useState<InsertPosition | null>(null)
  const draggedIndex = useRef<number | null>(null)
  const network = describeVisualNetwork(layers, imageShape, outputClasses)
  const latest = snapshots.at(-1)?.network
  const editable = Boolean(onChange)

  const insert = (type: LayerType) => {
    if (!insertPosition || !onChange) return
    const next = [...layers]
    next.splice(insertPosition.index, 0, createLayer(type, layers))
    onChange(next)
    setInsertPosition(null)
  }
  const update = (index: number, patch: Partial<VisualLayer>) => {
    if (!onChange) return
    onChange(layers.map((layer, layerIndex) => layerIndex === index ? { ...layer, ...patch } as VisualLayer : layer))
  }
  const dragStart = (event: DragEvent<HTMLElement>, index: number) => {
    draggedIndex.current = index
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', String(index))
      event.dataTransfer.effectAllowed = 'move'
    }
  }
  const drop = (event: DragEvent<HTMLElement>, targetIndex: number) => {
    event.preventDefault()
    const sourceIndex = draggedIndex.current ?? Number(event.dataTransfer?.getData('text/plain'))
    if (!onChange || !Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= layers.length || sourceIndex === targetIndex) return
    const next = [...layers]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    onChange(next)
    draggedIndex.current = null
  }

  return <section className={`network-flow-canvas ${status === '训练中…' ? 'is-flowing' : ''}`} aria-label="神经网络数据流">
    <header><div><p className="eyebrow">网络数据流</p><h3>神经网络数据流</h3></div><span role="status">{status}</span></header>
    {!network.valid && <ul className="network-flow-errors" role="alert">{network.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>}
    <div className="network-flow-viewport">
      <div className="network-flow-track">
        <div className="network-flow-step">
          <article className="network-flow-node network-flow-input"><strong>输入</strong><small>{imageShape.channels}×{imageShape.height}×{imageShape.width}</small></article>
          {editable && <InsertionControl label="输入后" onClick={() => setInsertPosition({ index: 0, label: '输入后' })} />}
        </div>
        {network.layers.slice(0, -1).map((description, index) => {
          const layer = layers[index]
          return <div className="network-flow-step" key={layer.id}>
            <div className="network-flow-link" style={{ '--flow-delay': `${index * 180}ms` } as CSSProperties}>
              <i />
              <article className="network-flow-node" role="listitem" aria-label={description.name} draggable={editable} onDragStart={event => dragStart(event, index)} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, index)}>
                <strong>{description.name}</strong>
                <small>{description.shape} · {description.parameters.toLocaleString()} 参数{latest?.[index] ? ` · 激活 ${latest[index].activation.toFixed(2)}` : ''}</small>
                {editable && <div className="network-flow-controls" onClick={event => event.stopPropagation()}>
                  {layer.type === 'conv2d' && <label>滤波器 <input aria-label="卷积滤波器数" type="number" min="1" max="32" step="1" value={layer.filters} onChange={event => update(index, { filters: Number(event.target.value) })} /></label>}
                  {layer.type === 'dense' && <label>神经元 <input aria-label="全连接神经元数" type="number" min="1" max="128" step="1" value={layer.units} onChange={event => update(index, { units: Number(event.target.value) })} /></label>}
                  {layer.type === 'activation' && <label>函数 <select aria-label="激活函数" value={layer.activation} onChange={event => update(index, { activation: event.target.value as VisualActivation })}><option value="relu">ReLU</option><option value="tanh">Tanh</option><option value="sigmoid">Sigmoid</option></select></label>}
                  {layer.type === 'dropout' && <label>丢弃率 <input aria-label="Dropout 丢弃率" type="number" min="0" max="0.8" step="0.05" value={layer.rate} onChange={event => update(index, { rate: Number(event.target.value) })} /></label>}
                </div>}
              </article>
            </div>
            {editable && <div className="network-flow-insertions"><InsertionControl label={`${description.name}（第 ${index + 1} 层）前`} onClick={() => setInsertPosition({ index, label: `${description.name}前` })} /><InsertionControl label={`${description.name}（第 ${index + 1} 层）后`} onClick={() => setInsertPosition({ index: index + 1, label: `${description.name}后` })} /></div>}
          </div>
        })}
        <div className="network-flow-link network-flow-output-link"><i /><article className="network-flow-node network-flow-output"><strong>{network.layers.at(-1)?.name}</strong><small>{network.layers.at(-1)?.shape} · {network.layers.at(-1)?.parameters.toLocaleString()} 参数</small></article></div>
      </div>
    </div>
    {insertPosition && <div className="network-flow-menu" role="group" aria-label={`${insertPosition.label}插入层`}>
      <span>{insertPosition.label}插入：</span>
      {([['conv2d', '卷积层'], ['max-pool', '最大池化'], ['dense', '全连接层'], ['activation', '激活层'], ['dropout', 'Dropout']] as const).map(([type, label]) => <button type="button" key={type} onClick={() => insert(type)}>{label}</button>)}
      <button type="button" aria-label="取消插入" onClick={() => setInsertPosition(null)}>取消</button>
    </div>}
  </section>
}

function InsertionControl({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="network-flow-insert" type="button" aria-label={`在${label}插入`} onClick={onClick}>＋</button>
}

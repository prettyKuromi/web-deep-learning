import { useState } from 'react'
import type { ImageShape } from '../datasets/dataset'
import { describeVisualNetwork, type VisualLayer } from './visualNetwork'
import './VisualNetworkBuilder.css'

export function VisualNetworkBuilder({ layers, imageShape, onChange }: { layers: VisualLayer[]; imageShape: ImageShape; onChange: (layers: VisualLayer[]) => void }) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const network = describeVisualNetwork(layers, imageShape, 10)
  const add = (type: VisualLayer['type']) => {
    const id = `${type}-${Date.now()}`
    const layer: VisualLayer = type === 'conv2d' ? { id, type, filters: 8 } : type === 'dense' ? { id, type, units: 32 } : type === 'activation' ? { id, type, activation: 'relu' } : type === 'dropout' ? { id, type, rate: 0.1 } : { id, type }
    onChange([...layers, layer])
  }
  const update = (id: string, patch: Partial<VisualLayer>) => onChange(layers.map((layer) => layer.id === id ? { ...layer, ...patch } as VisualLayer : layer))
  const move = (index: number, delta: number) => { const next = [...layers]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onChange(next) }
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= layers.length || to >= layers.length) return
    const next = [...layers]
    const [layer] = next.splice(from, 1)
    next.splice(to, 0, layer)
    onChange(next)
  }
  return <section className="visual-network-builder" aria-label="网络结构搭建器">
    <header><div><p className="eyebrow">网络结构</p><h3>搭建网络</h3></div><strong>{network.totalParameters.toLocaleString()} 参数</strong></header>
    <div className="visual-network-add" aria-label="添加网络层"><button type="button" aria-expanded={isAddMenuOpen} onClick={() => setIsAddMenuOpen((open) => !open)}>新建层</button>{isAddMenuOpen && <div className="visual-network-add-menu">{([['conv2d', '卷积层'], ['max-pool', '池化层'], ['dense', '全连接层'], ['activation', '激活层'], ['dropout', 'Dropout']] as const).map(([type, label]) => <button type="button" key={type} onClick={() => { add(type); setIsAddMenuOpen(false) }}>+ {label}</button>)}</div>}</div>
    <ol><li className="visual-network-input"><strong>输入层 · {imageShape.width}×{imageShape.height} 灰度图像</strong><small>输入 {imageShape.channels}×{imageShape.height}×{imageShape.width}</small></li>{network.layers.filter((layer) => layer.id !== 'output').map((description, index) => { const layer = layers[index]; return <li key={layer.id} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedIndex != null) reorder(draggedIndex, index); setDraggedIndex(null) }} onDragEnd={() => setDraggedIndex(null)}><div><strong>{description.name}</strong><small>输出 {description.shape} · {description.parameters.toLocaleString()} 参数</small></div><div className="visual-network-actions"><button type="button" aria-label="上移" onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="下移" onClick={() => move(index, 1)}>↓</button><button type="button" aria-label="删除" onClick={() => onChange(layers.filter((item) => item.id !== layer.id))}>×</button></div>{layer.type === 'conv2d' && <label>滤波器 <input aria-label="卷积滤波器数" type="number" min="1" max="32" value={layer.filters} onChange={(event) => update(layer.id, { filters: Number(event.target.value) })} /></label>}{layer.type === 'dense' && <label>神经元 <input aria-label="全连接神经元数" type="number" min="1" max="128" value={layer.units} onChange={(event) => update(layer.id, { units: Number(event.target.value) })} /></label>}{layer.type === 'activation' && <label>函数 <select aria-label="激活函数" value={layer.activation} onChange={(event) => update(layer.id, { activation: event.target.value as 'relu' | 'tanh' | 'sigmoid' })}><option value="relu">ReLU</option><option value="tanh">Tanh</option><option value="sigmoid">Sigmoid</option></select></label>}{layer.type === 'dropout' && <label>丢弃率 <input aria-label="丢弃率" type="number" min="0" max="0.8" step="0.1" value={layer.rate} onChange={(event) => update(layer.id, { rate: Number(event.target.value) })} /></label>}</li> })}<li className="visual-network-output"><strong>输出层 · 10 类 Softmax</strong><small>输出 10 · {network.layers.at(-1)?.parameters.toLocaleString()} 参数</small></li></ol>
    {!network.valid && <p role="alert">{network.errors.join('；')}</p>}
  </section>
}

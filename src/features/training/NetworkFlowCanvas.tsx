import type { ImageShape } from '../datasets/dataset'
import type { CSSProperties } from 'react'
import type { TrainSnapshot } from './types'
import { describeVisualNetwork, type VisualLayer } from './visualNetwork'
import './NetworkFlowCanvas.css'

export function NetworkFlowCanvas({ layers, imageShape, status, snapshots }: { layers: VisualLayer[]; imageShape: ImageShape; status: string; snapshots: readonly TrainSnapshot[] }) {
  const network = describeVisualNetwork(layers, imageShape, 10)
  const latest = snapshots.at(-1)?.network
  return <section className={`network-flow-canvas ${status === '训练中…' ? 'is-flowing' : ''}`} aria-label="神经网络数据流">
    <header><div><p className="eyebrow">网络数据流</p><h3>神经网络数据流</h3></div><span>{status === '训练中…' ? '数据流动中' : status}</span></header>
    <div className="network-flow-track"><article className="network-flow-node"><strong>输入</strong><small>{imageShape.channels}×{imageShape.height}×{imageShape.width}</small></article>{network.layers.map((layer, index) => <div className="network-flow-link" style={{ '--flow-delay': `${index * 180}ms` } as CSSProperties} key={layer.id}><i /><article className="network-flow-node"><strong>{layer.name}</strong><small>{layer.shape} · {layer.parameters.toLocaleString()} 参数{latest?.[index] ? ` · 激活 ${latest[index].activation.toFixed(2)}` : ''}</small></article></div>)}</div>
  </section>
}

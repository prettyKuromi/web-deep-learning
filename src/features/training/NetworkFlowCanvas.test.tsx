import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetworkFlowCanvas } from './NetworkFlowCanvas'
import { defaultVisualLayers, type VisualLayer } from './visualNetwork'

const imageShape = { width: 8, height: 8, channels: 1 }
const snapshots = [] as const

describe('网络数据流画布', () => {
  afterEach(cleanup)

  it('编辑激活函数与数值参数时回调新的层数组和对象', () => {
    const layers = defaultVisualLayers()
    const onChange = vi.fn()
    render(<NetworkFlowCanvas layers={layers} imageShape={imageShape} status="就绪" snapshots={snapshots} onChange={onChange} />)

    fireEvent.change(screen.getAllByLabelText('激活函数')[0], { target: { value: 'tanh' } })
    expect(onChange.mock.lastCall?.[0]).not.toBe(layers)
    expect(onChange.mock.lastCall?.[0][1]).not.toBe(layers[1])
    expect(onChange.mock.lastCall?.[0][1]).toMatchObject({ activation: 'tanh' })

    fireEvent.change(screen.getAllByLabelText('卷积滤波器数')[0], { target: { value: '12' } })
    expect(onChange.mock.lastCall?.[0][0]).toMatchObject({ filters: 12 })
    fireEvent.change(screen.getAllByLabelText('全连接神经元数')[0], { target: { value: '48' } })
    expect(onChange.mock.lastCall?.[0][3]).toMatchObject({ units: 48 })
    fireEvent.change(screen.getAllByLabelText('Dropout 丢弃率')[0], { target: { value: '0.4' } })
    expect(onChange.mock.lastCall?.[0][5]).toMatchObject({ rate: 0.4 })
  })

  it('在指定层前后插入层并生成唯一 id', () => {
    const layers = defaultVisualLayers()
    const onChange = vi.fn()
    render(<NetworkFlowCanvas layers={layers} imageShape={imageShape} status="就绪" snapshots={snapshots} onChange={onChange} />)
    const conv = screen.getByRole('listitem', { name: /卷积层/ })
    fireEvent.click(within(conv.closest('.network-flow-step') as HTMLElement).getByRole('button', { name: /在卷积层.*前插入/ }))
    fireEvent.click(screen.getByRole('button', { name: '激活层' }))
    expect(onChange.mock.lastCall?.[0].map((layer: VisualLayer) => layer.id)).toEqual(expect.arrayContaining(['conv-1', 'activation-1']))
    expect(new Set(onChange.mock.lastCall?.[0].map((layer: VisualLayer) => layer.id)).size).toBe(layers.length + 1)
    expect(onChange.mock.lastCall?.[0][0].type).toBe('activation')

    fireEvent.click(within(conv.closest('.network-flow-step') as HTMLElement).getByRole('button', { name: /在卷积层.*后插入/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Dropout' }))
    expect(onChange.mock.lastCall?.[0][1].type).toBe('dropout')
  })

  it('通过拖放重排用户层', () => {
    const onChange = vi.fn()
    render(<NetworkFlowCanvas layers={defaultVisualLayers()} imageShape={imageShape} status="就绪" snapshots={snapshots} onChange={onChange} />)
    const activation = screen.getAllByRole('listitem', { name: /激活层/ })[0]
    const pool = screen.getByRole('listitem', { name: /最大池化/ })
    fireEvent.dragStart(activation)
    fireEvent.dragOver(pool)
    fireEvent.drop(pool)
    expect(onChange.mock.lastCall?.[0].map((layer: VisualLayer) => layer.id)).toEqual(['conv-1', 'pool-1', 'activation-1', 'dense-1', 'activation-2', 'dropout-1'])
  })

  it('显示动态输出类别数', () => {
    render(<NetworkFlowCanvas layers={defaultVisualLayers()} imageShape={imageShape} status="就绪" snapshots={snapshots} outputClasses={4} />)
    expect(screen.getByText(/输出层 · 4 类 Softmax/)).toBeInTheDocument()
  })

  it('在画布内呈现无效网络错误', () => {
    const layers: VisualLayer[] = [{ id: 'pool-only', type: 'max-pool' }]
    render(<NetworkFlowCanvas layers={layers} imageShape={imageShape} status="就绪" snapshots={snapshots} />)
    expect(screen.getByRole('alert')).toHaveTextContent('至少添加一个卷积层或全连接层')
  })
})

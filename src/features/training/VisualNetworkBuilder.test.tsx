import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VisualNetworkBuilder } from './VisualNetworkBuilder'
import { defaultVisualLayers } from './visualNetwork'

describe('可视化网络构建器', () => {
  afterEach(cleanup)

  it('通过新建层按钮展开层类型菜单', () => {
    render(<VisualNetworkBuilder layers={defaultVisualLayers()} imageShape={{ width: 8, height: 8, channels: 1 }} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: '+ 卷积层' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '新建层' }))
    expect(screen.getByRole('button', { name: '+ 卷积层' })).toBeInTheDocument()
  })

  it('显示不可编辑的输入层并通过菜单新增网络层', () => {
    const onChange = vi.fn()
    render(<VisualNetworkBuilder layers={defaultVisualLayers()} imageShape={{ width: 8, height: 8, channels: 1 }} onChange={onChange} />)

    expect(screen.getByText('输入层 · 8×8 灰度图像')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '新建层' }))
    fireEvent.click(screen.getByRole('button', { name: '+ 池化层' }))
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ type: 'max-pool' })]))
  })

  it('直接编辑层参数，并保留上移、下移和删除操作', () => {
    const onChange = vi.fn()
    render(<VisualNetworkBuilder layers={defaultVisualLayers()} imageShape={{ width: 8, height: 8, channels: 1 }} onChange={onChange} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: '卷积滤波器数' }), { target: { value: '12' } })
    fireEvent.click(screen.getAllByRole('button', { name: '下移' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ id: 'conv-1', filters: 12 })
  })

  it('将拖到目标层的网络层重排', () => {
    const onChange = vi.fn()
    render(<VisualNetworkBuilder layers={defaultVisualLayers()} imageShape={{ width: 8, height: 8, channels: 1 }} onChange={onChange} />)

    const items = screen.getAllByRole('listitem')
    fireEvent.dragStart(items[1])
    fireEvent.dragOver(items[3])
    fireEvent.drop(items[3])

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'activation-1' }),
      expect.objectContaining({ id: 'pool-1' }),
      expect.objectContaining({ id: 'conv-1' }),
      expect.objectContaining({ id: 'dense-1' }),
      expect.objectContaining({ id: 'activation-2' }),
      expect.objectContaining({ id: 'dropout-1' }),
    ])
  })
})

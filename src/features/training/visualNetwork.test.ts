import { describe, expect, it } from 'vitest'
import { defaultVisualLayers, describeVisualNetwork } from './visualNetwork'

describe('可视化网络结构', () => {
  it('推导卷积、池化和全连接层的输出形状及参数量', () => {
    const description = describeVisualNetwork(defaultVisualLayers(), { width: 8, height: 8, channels: 1 }, 10)
    expect(description.valid).toBe(true)
    expect(description.layers.map((layer) => layer.shape)).toContain('8×4×4')
    expect(description.layers.some((layer) => layer.parameters > 0)).toBe(true)
  })

  it('在池化会消除空间维度时阻止训练', () => {
    const description = describeVisualNetwork([
      { id: 'pool-a', type: 'max-pool' },
      { id: 'pool-b', type: 'max-pool' },
      { id: 'pool-c', type: 'max-pool' },
    ], { width: 8, height: 8, channels: 1 }, 10)
    expect(description).toMatchObject({ valid: false })
  })
})

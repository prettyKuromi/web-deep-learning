import { describe, expect, it } from 'vitest'
import { defaultParameters, validateParameters } from './modelParameters'

describe('时序模型参数', () => {
  it('提供 LSTM 和 Transformer 默认配置', () => {
    expect(defaultParameters('lstm')).toMatchObject({ hiddenSize: 8, epochs: 80, batchSize: 16, seed: 42 })
    expect(defaultParameters('transformer')).toMatchObject({ modelDimension: 8, attentionHeads: 2, feedForwardSize: 16 })
    expect(validateParameters('transformer', {})).toBe('')
  })

  it('拒绝模型维度不能被注意力头数整除的 Transformer 配置', () => {
    expect(validateParameters('transformer', { modelDimension: 8, attentionHeads: 3 })).toBe('模型维度必须能被注意力头数整除')
    expect(validateParameters('transformer', { modelDimension: 9, attentionHeads: 3 })).toBe('')
  })
})

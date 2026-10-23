import { describe, expect, it } from 'vitest'
import { isModelCompatible } from './workbenchTypes'
import { generateBuiltinDataset } from '../features/datasets/dataset'

describe('模型与数据集兼容性', () => {
  it('拒绝图像模型与表格数据的组合', () => {
    expect(isModelCompatible('visual-cnn', { features: [[0, 1]], labels: [0], dataType: 'tabular' })).toMatchObject({ compatible: false, reason: '仅支持带图像尺寸信息的图像数据集' })
  })

  it('拒绝表格模型与图像数据的组合', () => {
    expect(isModelCompatible('mlp', { features: [[0]], labels: [0], dataType: 'image' })).toMatchObject({ compatible: false, reason: '仅支持二维或表格数值数据集' })
  })

  it('仅允许 LSTM 和 Transformer 使用时序波形数据', () => {
    const dataset = generateBuiltinDataset('sequence-waves', { samples: 8 })
    expect(isModelCompatible('lstm', dataset)).toEqual({ compatible: true })
    expect(isModelCompatible('transformer', dataset)).toEqual({ compatible: true })
    expect(isModelCompatible('mlp', dataset).compatible).toBe(false)
    expect(isModelCompatible('lstm', { features: [[1, 2]], labels: [0, 1] }).compatible).toBe(false)
  })
})

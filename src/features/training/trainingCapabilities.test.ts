import { describe, expect, it } from 'vitest'
import { getTrainingCapability } from './trainingCapabilities'

describe('训练能力注册表', () => {
  it('迭代型模型声明真实总量和控制能力', () => {
    expect(getTrainingCapability('logistic-regression', { iterations: 12 })).toEqual({ unit: 'iteration', total: 12, canPause: true, canStep: true, canStop: true })
  })

  it('一次性拟合模型不伪造暂停或百分比', () => {
    expect(getTrainingCapability('knn')).toEqual({ unit: 'fit', total: undefined, canPause: false, canStep: false, canStop: true })
  })

  it('树和轮次模型使用对应配置字段', () => {
    expect(getTrainingCapability('random-forest', { trees: 8 }).unit).toBe('tree')
    expect(getTrainingCapability('adaboost', { rounds: 6 }).total).toBe(6)
  })

  it('LSTM 和 Transformer 按轮次训练且支持训练控制', () => {
    expect(getTrainingCapability('lstm', { epochs: 7 })).toEqual({ unit: 'epoch', total: 7, canPause: true, canStep: true, canStop: true })
    expect(getTrainingCapability('transformer', { epochs: 5 }).total).toBe(5)
  })
})

import { describe, expect, it } from 'vitest'
import { getStageProgress } from './stageState'

const validDataset = {
  features: [[0, 0], [1, 1]] as [number, number][],
  labels: ['a', 'b'],
  name: '测试数据',
}

describe('getStageProgress', () => {
  it('无数据时仅数据集阶段 active，后续阶段 blocked', () => {
    expect(getStageProgress({ dataset: null, modelConfig: null, training: null })).toEqual({
      dataset: 'active',
      model: 'blocked',
      training: 'blocked',
      results: 'blocked',
    })
  })

  it('数据有效后模型阶段 active，训练和结果 blocked', () => {
    expect(getStageProgress({ dataset: validDataset, modelConfig: null, training: null })).toEqual({
      dataset: 'completed',
      model: 'active',
      training: 'blocked',
      results: 'blocked',
    })
  })

  it('模型配置有效后训练阶段 active', () => {
    expect(getStageProgress({
      dataset: validDataset,
      modelConfig: { kind: 'knn', params: { k: 1 } },
      training: { status: '等待训练', progress: 0, snapshots: [] },
    })).toEqual({
      dataset: 'completed',
      model: 'completed',
      training: 'active',
      results: 'blocked',
    })
  })

  it('有训练结果后结果阶段 completed，训练阶段 completed', () => {
    expect(getStageProgress({
      dataset: validDataset,
      modelConfig: { kind: 'knn', params: { k: 1 } },
      training: {
        status: '训练完成',
        progress: 100,
        snapshots: [],
        metrics: {
          accuracy: 1,
          precision: 1,
          recall: 1,
          f1: 1,
          labels: ['a', 'b'],
          confusionMatrix: [[1, 0], [0, 1]],
        },
      },
    })).toEqual({
      dataset: 'completed',
      model: 'completed',
      training: 'completed',
      results: 'completed',
    })
  })
})

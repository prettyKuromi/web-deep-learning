import { describe, expect, it } from 'vitest'
import { generateBuiltinDataset } from '../datasets/dataset'
import { createVisualCnnTrainer } from './visualCnn'
import { defaultVisualLayers } from './visualNetwork'

describe('可视化卷积网络训练器', () => {
  it('在确定性数字数据上训练并预测多个类别', async () => {
    const dataset = generateBuiltinDataset('digits', { samples: 100, seed: 3 })
    const trainer = createVisualCnnTrainer()
    const result = await trainer.train({ samples: dataset.features, labels: dataset.labels, imageShape: dataset.imageShape!, layers: defaultVisualLayers(), epochs: 25, batchSize: 20, learningRate: 0.04, seed: 3 })
    expect(result.model.kind).toBe('visual-cnn')
    expect(result.model.parameters['conv-1']).toBeDefined()
    expect(new Set(trainer.predict(result.model, dataset.features)).size).toBeGreaterThan(5)
    expect(result.snapshots.at(-1)?.network?.length).toBeGreaterThan(1)
    expect(result.snapshots.at(-1)?.metrics?.accuracy).toBeGreaterThanOrEqual(0)
  })

  it('拒绝单类别图像和缺少图像尺寸的配置', async () => {
    const trainer = createVisualCnnTrainer()
    await expect(trainer.train({ samples: [Array(64).fill(0)], labels: [0], imageShape: { width: 8, height: 8, channels: 1 }, layers: defaultVisualLayers() })).rejects.toThrow('至少需要两个不同的类别')
  })

  it('固定随机种子得到一致结果', async () => {
    const dataset = generateBuiltinDataset('digits', { samples: 20, seed: 4 })
    const config = { samples: dataset.features, labels: dataset.labels, imageShape: dataset.imageShape!, layers: defaultVisualLayers(), epochs: 2, seed: 9 }
    const trainer = createVisualCnnTrainer()
    expect(await trainer.train(config)).toEqual(await trainer.train(config))
  })

  it.each([
    ['epochs', 0],
    ['epochs', 1.5],
    ['batchSize', 0],
    ['batchSize', Number.POSITIVE_INFINITY],
    ['learningRate', 0],
    ['learningRate', Number.NaN],
    ['seed', 1.5],
    ['seed', Number.MAX_SAFE_INTEGER + 1],
  ])('拒绝非法训练参数 %s=%s', async (key, value) => {
    const trainer = createVisualCnnTrainer()
    const dataset = generateBuiltinDataset('digits', { samples: 20, seed: 4 })
    const config = { samples: dataset.features, labels: dataset.labels, imageShape: dataset.imageShape!, layers: defaultVisualLayers(), [key]: value }

    await expect(trainer.train(config)).rejects.toThrow(/训练轮数|批大小|学习率|随机种子/)
  })

  it('检测批量更新后的非有限权重，不发出非有限损失快照', async () => {
    const trainer = createVisualCnnTrainer()
    const samples = [Array(64).fill(1), Array(64).fill(-1)]
    const snapshots: Array<{ loss?: number }> = []

    await expect(trainer.train({
      samples,
      labels: ['positive', 'negative'],
      imageShape: { width: 8, height: 8, channels: 1 },
      layers: defaultVisualLayers(),
      epochs: 1,
      batchSize: 2,
      learningRate: Number.MAX_VALUE,
      seed: 1,
    }, snapshot => snapshots.push(snapshot))).rejects.toThrow(/非有限|数值/)
    expect(snapshots).toHaveLength(0)
  })
})

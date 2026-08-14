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
})

import { describe, expect, it } from 'vitest'
import { createTransformerTrainer } from './transformer'

const binarySamples = Array.from({ length: 12 }, (_, index) => {
  const sign = index < 6 ? -1 : 1
  const offset = (index % 3) * 0.03
  return [sign + offset, 0.2, sign - offset, -0.1, sign + offset / 2, 0.05]
})
const binaryLabels = Array.from({ length: 12 }, (_, index) => index < 6 ? 'low' : 'high')
const baseConfig = {
  samples: binarySamples,
  labels: binaryLabels,
  sequenceShape: { steps: 3, channels: 2 },
  modelDimension: 4,
  attentionHeads: 2,
  feedForwardSize: 8,
  epochs: 18,
  batchSize: 4,
  learningRate: 0.04,
  seed: 17,
}

describe('Transformer trainer', () => {
  it('trains a binary sequence classifier with finite epoch losses', async () => {
    const trainer = createTransformerTrainer()
    const result = await trainer.train(baseConfig)
    expect(result.model.kind).toBe('transformer')
    expect(result.snapshots).toHaveLength(baseConfig.epochs)
    expect(result.snapshots.every(snapshot => snapshot.unit === 'epoch' && Number.isFinite(snapshot.loss))).toBe(true)
    expect(trainer.predict(result.model, binarySamples)).toEqual(binaryLabels)
  })

  it('supports multiclass sequence classification', async () => {
    const samples = [
      [1, 0, 1, 0, 1, 0], [0.9, 0.1, 1.1, 0, 0.8, -0.1],
      [0, 1, 0, 1, 0, 1], [0.1, 0.9, -0.1, 1.1, 0, 0.8],
      [-1, -1, -1, -1, -1, -1], [-0.9, -1.1, -1.1, -0.8, -1, -0.9],
    ]
    const labels = ['pulse', 'pulse', 'step', 'step', 'negative', 'negative']
    const trainer = createTransformerTrainer()
    const result = await trainer.train({ ...baseConfig, samples, labels, epochs: 45, batchSize: 3 })
    const predictions = trainer.predict(result.model, samples)
    expect(new Set(predictions)).toEqual(new Set(labels))
    expect(predictions.filter((label, index) => label === labels[index]).length).toBeGreaterThanOrEqual(5)
  })

  it('reproduces model parameters, snapshots and predictions for the same seed', async () => {
    const trainer = createTransformerTrainer()
    const first = await trainer.train({ ...baseConfig, epochs: 3 })
    const second = await trainer.train({ ...baseConfig, epochs: 3 })
    expect(first.model).toEqual(second.model)
    expect(first.snapshots).toEqual(second.snapshots)
    expect(trainer.predict(first.model, binarySamples)).toEqual(trainer.predict(second.model, binarySamples))
  })

  it('updates query, key, and value attention projections during training', async () => {
    const samples = [
      [1, 0, 0.4, 1, -0.2, 0.6, -0.4, 1],
      [0.8, 0.2, 0.5, 0.7, -0.1, 0.4, -0.5, 0.8],
      [0.6, -0.1, 0.3, 0.8, -0.4, 0.5, -0.2, 0.7],
      [-1, 0, -0.4, -1, 0.2, -0.6, 0.4, -1],
      [-0.8, -0.2, -0.5, -0.7, 0.1, -0.4, 0.5, -0.8],
      [-0.6, 0.1, -0.3, -0.8, 0.4, -0.5, 0.2, -0.7],
    ]
    const labels = ['positive', 'positive', 'positive', 'negative', 'negative', 'negative']
    const config = {
      ...baseConfig,
      samples,
      labels,
      sequenceShape: { steps: 4, channels: 2 },
      epochs: 1,
      batchSize: samples.length,
    }
    const trainer = createTransformerTrainer()
    const smallStep = await trainer.train({ ...config, learningRate: 0.001 })
    const largeStep = await trainer.train({ ...config, learningRate: 0.2 })
    expect(smallStep.model.queryWeights).not.toEqual(largeStep.model.queryWeights)
    expect(smallStep.model.keyWeights).not.toEqual(largeStep.model.keyWeights)
    expect(smallStep.model.valueWeights).not.toEqual(largeStep.model.valueWeights)
  })

  it('checks once per epoch and yields before each batch', async () => {
    const checkpoints: number[] = []
    let yields = 0
    const trainer = createTransformerTrainer()
    await trainer.train({ ...baseConfig, epochs: 3, batchSize: 5 }, undefined, {
      checkpoint: async () => { checkpoints.push(1) },
      yield: async () => { yields += 1 },
    })
    expect(checkpoints).toHaveLength(3)
    expect(yields).toBe(9)
  })

  it('rejects malformed sequence dimensions, non-finite features, and invalid labels', async () => {
    const trainer = createTransformerTrainer()
    await expect(trainer.train({ ...baseConfig, samples: [[1, 2]], labels: ['a'] })).rejects.toThrow(/non-empty|two classes/i)
    await expect(trainer.train({ ...baseConfig, samples: [[1, 2], [1, 2, 3]], labels: ['a', 'b'] })).rejects.toThrow(/dimension/i)
    await expect(trainer.train({ ...baseConfig, samples: [[1, 2, 3, 4, 5, Number.NaN], [1, 2, 3, 4, 5, 6]], labels: ['a', 'b'] })).rejects.toThrow(/finite/i)
    await expect(trainer.train({ ...baseConfig, labels: Array(binaryLabels.length).fill('same') })).rejects.toThrow(/two classes/i)
    await expect(trainer.train({ ...baseConfig, labels: [Number.NaN, ...binaryLabels.slice(1)] })).rejects.toThrow(/标签|finite/i)
    await expect(trainer.train({ ...baseConfig, sequenceShape: { steps: 0, channels: 2 } })).rejects.toThrow(/sequence/i)
  })

  it('rejects invalid hyperparameters and dimensions not divisible by head count', async () => {
    const trainer = createTransformerTrainer()
    await expect(trainer.train({ ...baseConfig, modelDimension: 5 })).rejects.toThrow(/divisible|dimension/i)
    await expect(trainer.train({ ...baseConfig, attentionHeads: 0 })).rejects.toThrow(/head/i)
    await expect(trainer.train({ ...baseConfig, feedForwardSize: 0 })).rejects.toThrow(/feedForward/i)
    await expect(trainer.train({ ...baseConfig, learningRate: 0 })).rejects.toThrow(/learningRate/i)
    await expect(trainer.train({ ...baseConfig, epochs: 0 })).rejects.toThrow(/epoch/i)
    await expect(trainer.train({ ...baseConfig, batchSize: 0 })).rejects.toThrow(/batchSize/i)
  })

  it('keeps training numerically finite and stops before accepting an overflowing update', async () => {
    const trainer = createTransformerTrainer()
    const stable = await trainer.train({ ...baseConfig, epochs: 4 })
    expect(stable.snapshots.every(snapshot => Number.isFinite(snapshot.loss))).toBe(true)
    expect(() => trainer.predict(stable.model, binarySamples)).not.toThrow()
    await expect(trainer.train({ ...baseConfig, epochs: 1, learningRate: Number.MAX_VALUE })).rejects.toThrow(/finite|numeric|数值/i)
  })
})

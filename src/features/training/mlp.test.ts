import { describe, expect, it } from 'vitest'
import { createMlpTrainer } from './mlp'

const xorSamples = [[0, 0], [0, 1], [1, 0], [1, 1]]
const xorLabels = [0, 1, 1, 0]

describe('MLP trainer', () => {
  it('learns XOR with a hidden layer', async () => {
    const trainer = createMlpTrainer()
    const result = await trainer.train({ samples: xorSamples, labels: xorLabels, hiddenLayers: [8], epochs: 1200, learningRate: 0.5, batchSize: 4, seed: 7 })
    expect(trainer.predict(result.model, xorSamples)).toEqual(xorLabels)
  })

  it('supports multiclass classification and all activations', async () => {
    const samples = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.8, 0.2], [-0.8, -0.2]]
    const labels = ['a', 'b', 'c', 'd', 'a', 'c']
    for (const activation of ['relu', 'tanh', 'sigmoid'] as const) {
      const trainer = createMlpTrainer()
      const result = await trainer.train({ samples, labels, hiddenLayers: [10], activation, epochs: 300, learningRate: 0.2, batchSize: 3, seed: 3 })
      expect(new Set(trainer.predict(result.model, samples)).size).toBeGreaterThan(1)
    }
  })

  it('is reproducible with a fixed seed', async () => {
    const config = { samples: xorSamples, labels: xorLabels, hiddenLayers: [4], epochs: 20, seed: 11 }
    const trainer = createMlpTrainer()
    const a = await trainer.train(config)
    const b = await trainer.train(config)
    expect(a.model).toEqual(b.model)
    expect(a.snapshots).toEqual(b.snapshots)
  })

  it('rejects invalid input and prediction dimensions', async () => {
    const trainer = createMlpTrainer()
    await expect(trainer.train({ samples: [], labels: [] })).rejects.toThrow(/non-empty/i)
    await expect(trainer.train({ samples: [[1], [2, 3]], labels: [0, 1] })).rejects.toThrow(/dimensions/i)
    const result = await trainer.train({ samples: [[0], [1]], labels: [0, 1], epochs: 1 })
    expect(() => trainer.predict(result.model, [[1, 2]])).toThrow(/dimensions/i)
  })
})

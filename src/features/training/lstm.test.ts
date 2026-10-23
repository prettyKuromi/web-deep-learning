import { describe, expect, it } from 'vitest'
import { createLstmTrainer } from './lstm'

const samples = [
  [1, 0],
  [0.9, 0.1],
  [0.8, 0.2],
  [-1, 0],
  [-0.9, -0.1],
  [-0.8, -0.2],
]
const labels = ['positive', 'positive', 'positive', 'negative', 'negative', 'negative']
const sequenceShape = { steps: 2, channels: 1 }

describe('LSTM trainer', () => {
  it('classifies fixed-length sequences and emits one loss snapshot per epoch', async () => {
    const trainer = createLstmTrainer()
    const emitted: Array<{ epoch?: number; loss?: number }> = []
    const result = await trainer.train({
      samples,
      labels,
      sequenceShape,
      hiddenSize: 6,
      learningRate: 0.2,
      epochs: 100,
      batchSize: 2,
      seed: 13,
    }, snapshot => emitted.push(snapshot))

    expect(trainer.predict(result.model, samples)).toEqual(labels)
    expect(result.snapshots).toHaveLength(100)
    expect(emitted).toEqual(result.snapshots)
    expect(result.snapshots.map(snapshot => snapshot.epoch)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1))
    expect(result.snapshots.every(snapshot => Number.isFinite(snapshot.loss))).toBe(true)
  })

  it('supports multiclass sequence classification', async () => {
    const trainer = createLstmTrainer()
    const multiclassSamples = [
      [1, 0, 1], [0.8, 0.1, 0.8],
      [0, 1, 0], [0.1, 0.8, 0.1],
      [-1, -1, -1], [-0.8, -0.8, -0.8],
    ]
    const multiclassLabels = ['a', 'a', 'b', 'b', 'c', 'c']
    const result = await trainer.train({
      samples: multiclassSamples,
      labels: multiclassLabels,
      sequenceShape: { steps: 3, channels: 1 },
      hiddenSize: 8,
      learningRate: 0.15,
      epochs: 180,
      batchSize: 3,
      seed: 4,
    })

    expect(trainer.predict(result.model, multiclassSamples)).toEqual(multiclassLabels)
    expect(result.model.labels).toEqual(['a', 'b', 'c'])
  })

  it('is reproducible with the same seed, including shuffled batches', async () => {
    const trainer = createLstmTrainer()
    const config = { samples, labels, sequenceShape, hiddenSize: 4, epochs: 8, batchSize: 2, seed: 29 }
    const first = await trainer.train(config)
    const second = await trainer.train(config)

    expect(second.model).toEqual(first.model)
    expect(second.snapshots).toEqual(first.snapshots)
  })

  it('checks control once per epoch and yields between mini-batches', async () => {
    const trainer = createLstmTrainer()
    let checkpoints = 0
    let yields = 0
    await trainer.train({ samples, labels, sequenceShape, epochs: 3, batchSize: 2, seed: 1 }, undefined, {
      checkpoint: async () => { checkpoints += 1 },
      yield: async () => { yields += 1 },
    })

    expect(checkpoints).toBe(3)
    expect(yields).toBe(9)
  })

  it('rejects invalid sequence data, labels, shapes, and training parameters', async () => {
    const trainer = createLstmTrainer()
    const valid = { samples, labels, sequenceShape }

    await expect(trainer.train({ ...valid, samples: [], labels: [] })).rejects.toThrow(/non-empty/i)
    await expect(trainer.train({ ...valid, labels: labels.slice(1) })).rejects.toThrow(/equal|match/i)
    await expect(trainer.train({ ...valid, sequenceShape: { steps: 2, channels: 2 } })).rejects.toThrow(/steps.*channels|sequence.*dimension/i)
    await expect(trainer.train({ ...valid, samples: [[1, Number.NaN], ...samples.slice(1)] })).rejects.toThrow(/finite/i)
    await expect(trainer.train({ ...valid, labels: Array(labels.length).fill('only-one') })).rejects.toThrow(/two.*class/i)
    await expect(trainer.train({ ...valid, sequenceShape: { steps: 0, channels: 1 } })).rejects.toThrow(/sequence|steps/i)
    await expect(trainer.train({ ...valid, hiddenSize: 0 })).rejects.toThrow(/hidden/i)
    await expect(trainer.train({ ...valid, learningRate: 0 })).rejects.toThrow(/learning/i)
    await expect(trainer.train({ ...valid, epochs: 0 })).rejects.toThrow(/epoch/i)
    await expect(trainer.train({ ...valid, batchSize: 0 })).rejects.toThrow(/batch/i)
    await expect(trainer.train({ ...valid, seed: Number.NaN })).rejects.toThrow(/seed/i)
  })



  it('rejects non-finite numeric labels', async () => {
    const trainer = createLstmTrainer()
    const config = { samples: [[0], [1]], sequenceShape: { steps: 1, channels: 1 }, epochs: 1 }

    for (const label of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      await expect(trainer.train({ ...config, labels: [label, 1] })).rejects.toThrow(/标签.*有限/)
    }
  })

  it('rejects non-finite updates from finite but extreme sequence values', async () => {
    const trainer = createLstmTrainer()
    const emitted: Array<{ loss?: number }> = []
    await expect(trainer.train({
      samples: [[200], [100], [-20]],
      labels: [0, 0, 1],
      sequenceShape: { steps: 1, channels: 1 },
      hiddenSize: 1,
      learningRate: Number.MAX_VALUE,
      epochs: 1,
      batchSize: 3,
      seed: 1,
    }, snapshot => emitted.push(snapshot))).rejects.toThrow(/非有限|有限数值/)
    expect(emitted).toHaveLength(0)
  })

  it('rejects prediction sequences with the wrong flattened dimension', async () => {
    const trainer = createLstmTrainer()
    const result = await trainer.train({ samples, labels, sequenceShape, epochs: 1, seed: 2 })

    expect(() => trainer.predict(result.model, [[1]])).toThrow(/dimension/i)
  })
})

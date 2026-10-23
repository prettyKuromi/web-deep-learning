import { describe, expect, it } from 'vitest'
import { generateBuiltinDataset } from '../datasets/dataset'
import { runTrainingInHandler, type WorkerTrainConfig } from './workerClient'

const dataset = generateBuiltinDataset('sequence-waves', { samples: 8, seed: 17 })

describe('时序模型 Worker 路由', () => {
  it('将 LSTM 路由到序列分类训练器并输出 epoch 快照', async () => {
    const snapshots: number[] = []
    const result = await runTrainingInHandler({
      kind: 'lstm', samples: dataset.features, labels: dataset.labels, sequenceShape: dataset.sequenceShape!,
      hiddenSize: 3, learningRate: 0.03, epochs: 2, batchSize: 4, seed: 42,
    }, snapshot => snapshots.push(snapshot.iteration))

    expect(result.model.kind).toBe('lstm')
    expect(snapshots).toEqual([1, 2])
    expect(result.snapshots.every(snapshot => Number.isFinite(snapshot.loss))).toBe(true)
  })

  it('将 Transformer 路由到序列分类训练器并输出 epoch 快照', async () => {
    const config: WorkerTrainConfig = {
      kind: 'transformer', samples: dataset.features, labels: dataset.labels, sequenceShape: dataset.sequenceShape!,
      modelDimension: 4, attentionHeads: 2, feedForwardSize: 8, learningRate: 0.01, epochs: 2, batchSize: 4, seed: 42,
    }
    const result = await runTrainingInHandler(config)

    expect(result.model.kind).toBe('transformer')
    expect(result.snapshots).toHaveLength(2)
    expect(result.snapshots.every(snapshot => Number.isFinite(snapshot.loss))).toBe(true)
  })
})

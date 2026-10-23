import { describe, expect, it } from 'vitest'
import type { ExperimentRecord } from '../../app/workbenchTypes'
import { generateBuiltinDataset } from '../datasets/dataset'
import { classificationMetrics } from '../training/metrics'
import { createLstmTrainer } from '../training/lstm'
import { createTransformerTrainer } from '../training/transformer'
import { exportExperiments, parseExperiments } from './persistence'
import { validateExperiment } from './validateExperiment'

async function createSequenceRecord(kind: 'lstm' | 'transformer'): Promise<ExperimentRecord> {
  const dataset = generateBuiltinDataset('sequence-waves', { samples: 8, seed: 21 })
  const config = kind === 'lstm'
    ? { samples: dataset.features, labels: dataset.labels, sequenceShape: dataset.sequenceShape!, hiddenSize: 2, learningRate: 0.03, epochs: 1, batchSize: 8, seed: 5 }
    : { samples: dataset.features, labels: dataset.labels, sequenceShape: dataset.sequenceShape!, modelDimension: 4, attentionHeads: 2, feedForwardSize: 8, learningRate: 0.01, epochs: 1, batchSize: 8, seed: 5 }
  const result = kind === 'lstm'
    ? await createLstmTrainer().train(config)
    : await createTransformerTrainer().train(config)
  const predictions = (kind === 'lstm' ? createLstmTrainer() : createTransformerTrainer()).predict(result.model as never, dataset.features) as Array<string | number>
  return {
    id: kind, createdAt: 1, dataset, modelKind: kind, config: kind === 'lstm'
      ? { hiddenSize: 2, learningRate: 0.03, epochs: 1, batchSize: 8, seed: 5 }
      : { modelDimension: 4, attentionHeads: 2, feedForwardSize: 8, learningRate: 0.01, epochs: 1, batchSize: 8, seed: 5 },
    metrics: classificationMetrics(dataset.labels, predictions), snapshots: result.snapshots, model: result.model, predictions,
  }
}

describe('时序实验记录持久化', () => {
  it.each(['lstm', 'transformer'] as const)('%s 实验可通过 JSON 导出和重新校验', async kind => {
    const record = await createSequenceRecord(kind)
    const restored = parseExperiments(await exportExperiments([record]))
    expect(restored).toEqual([record])
    expect(() => validateExperiment(record)).not.toThrow()
  })

  it('拒绝形状不匹配的序列数据与模型参数', async () => {
    const record = await createSequenceRecord('transformer')
    const invalidShape = { ...record, dataset: { ...record.dataset, sequenceShape: { steps: 16, channels: 1 } } }
    const invalidConfig = { ...record, config: { ...record.config, modelDimension: 3 } }

    expect(() => validateExperiment(invalidShape)).toThrow('序列尺寸')
    await expect(exportExperiments([invalidConfig])).rejects.toThrow('参数')
  })
})

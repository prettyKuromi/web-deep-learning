import type { FeatureMatrix, KnnModel, KnnTrainConfig, Labels, Trainer, TrainSnapshot } from './types'

export function createKnnTrainer(): Trainer<KnnTrainConfig, KnnModel> {
  return {
    async train(config, emit) {
      validateConfig(config)
      const model: KnnModel = {
        kind: 'knn',
        samples: config.samples.map(sample => [...sample]),
        labels: [...config.labels],
        k: config.k,
      }
      const snapshot: TrainSnapshot = { iteration: 0 }
      emit?.(snapshot)
      return { model, snapshots: [snapshot] }
    },
    predict(model, samples) {
      return samples.map(sample => predictOne(model, sample))
    },
  }
}

function validateConfig({ samples, labels, k }: KnnTrainConfig): void {
  if (!Number.isInteger(k) || k < 1) throw new Error('k must be a positive integer')
  if (samples.length === 0 || samples.length !== labels.length) throw new Error('samples and labels must be non-empty and have equal length')
  const dimensions = samples[0].length
  if (dimensions === 0 || samples.some(sample => sample.length !== dimensions || sample.some(value => !Number.isFinite(value)))) {
    throw new Error('samples must have consistent finite dimensions')
  }
}

function predictOne(model: KnnModel, sample: readonly number[]): KnnModel['labels'][number] {
  if (sample.length !== model.samples[0]?.length) throw new Error('sample dimensions do not match model')
  const nearest = model.samples
    .map((point, index) => ({ label: model.labels[index], distance: squaredDistance(point, sample), index }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, Math.min(model.k, model.samples.length))
  const votes = new Map<KnnModel['labels'][number], { count: number; distance: number; order: number }>()
  nearest.forEach(({ label, distance }, order) => {
    const vote = votes.get(label)
    if (vote) vote.count += 1
    else votes.set(label, { count: 1, distance, order })
  })
  return [...votes.entries()].sort((a, b) => b[1].count - a[1].count || a[1].distance - b[1].distance || a[1].order - b[1].order)[0][0]
}

function squaredDistance(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0)
}

export type { FeatureMatrix, Labels }

import type { KMeansModel, KMeansTrainConfig, Trainer, TrainSnapshot } from './types'

export function createKMeansTrainer(): Trainer<KMeansTrainConfig, KMeansModel, number[]> {
  return {
    async train(config, emit) {
      validate(config)
      const dimensions = config.samples[0].length
      const points = config.samples.map(row => [...row])
      const centroids = points.slice(0, config.k).map(row => [...row])
      const snapshots: TrainSnapshot[] = []
      for (let iteration = 0; iteration < (config.iterations ?? 100); iteration++) {
        const assignments = points.map(point => nearest(centroids, point))
        const sums = centroids.map(() => Array(dimensions).fill(0)); const counts = Array(config.k).fill(0)
        points.forEach((point, i) => { const c = assignments[i]; counts[c]++; point.forEach((v, j) => { sums[c][j] += v }) })
        centroids.forEach((centroid, i) => { if (counts[i]) centroid.forEach((_, j) => { centroid[j] = sums[i][j] / counts[i] }) })
        const loss = points.reduce((sum, point, i) => sum + squaredDistance(point, centroids[assignments[i]]), 0) / points.length
        if (iteration === 0 || iteration === (config.iterations ?? 100) - 1) { const snapshot = { iteration: iteration + 1, loss }; snapshots.push(snapshot); emit?.(snapshot) }
      }
      return { model: { kind: 'k-means', centroids, dimensions }, snapshots }
    },
    predict(model, samples) { return samples.map(sample => { if (sample.length !== model.dimensions) throw new Error('sample dimensions do not match model'); return nearest(model.centroids, sample) }) },
  }
}
function nearest(centroids: readonly number[][], point: readonly number[]): number { return centroids.map(c => squaredDistance(c, point)).reduce((best, value, i, all) => value < all[best] ? i : best, 0) }
function squaredDistance(a: readonly number[], b: readonly number[]): number { return a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0) }
function validate(config: KMeansTrainConfig): void { if (!config.samples.length || !Number.isInteger(config.k) || config.k < 1 || config.k > config.samples.length) throw new Error('samples must be non-empty and k must be valid'); const dimensions = config.samples[0].length; if (!dimensions || config.samples.some(row => row.length !== dimensions || row.some(value => !Number.isFinite(value)))) throw new Error('samples must have consistent finite dimensions') }

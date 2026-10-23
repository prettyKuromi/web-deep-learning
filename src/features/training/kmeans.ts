import type { KMeansModel, KMeansTrainConfig, Trainer, TrainSnapshot } from './types'

export function createKMeansTrainer(): Trainer<KMeansTrainConfig, KMeansModel, number[]> {
  return {
    async train(config, emit) {
      validate(config)
      const dimensions = config.samples[0].length
      const points = config.samples.map(row => [...row])
      const centroids = initializeCentroids(points, config.k, createRandom(config.seed ?? 42))
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
function initializeCentroids(points: number[][], k: number, random: () => number): number[][] {
  const selected = [Math.floor(random() * points.length)]
  const used = Array(points.length).fill(false)
  used[selected[0]] = true
  const nearestDistances = points.map(point => squaredDistance(point, points[selected[0]]))
  while (selected.length < k) {
    const total = nearestDistances.reduce((sum, distance) => sum + distance, 0)
    let next: number
    if (total === 0) {
      let remaining = Math.floor(random() * (points.length - selected.length))
      next = used.findIndex(isUsed => !isUsed && remaining-- === 0)
    } else {
      let target = random() * total
      next = nearestDistances.findIndex(distance => (target -= distance) < 0)
      if (next < 0) next = nearestDistances.length - 1
    }
    selected.push(next)
    used[next] = true
    nearestDistances.forEach((distance, index) => { nearestDistances[index] = Math.min(distance, squaredDistance(points[index], points[next])) })
  }
  return selected.map(index => [...points[index]])
}
function createRandom(seed: number): () => number { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 } }
function validate(config: KMeansTrainConfig): void { if (!config.samples.length || !Number.isInteger(config.k) || config.k < 1 || config.k > config.samples.length) throw new Error('samples must be non-empty and k must be valid'); const dimensions = config.samples[0].length; if (!dimensions || config.samples.some(row => row.length !== dimensions || row.some(value => !Number.isFinite(value)))) throw new Error('samples must have consistent finite dimensions'); if (config.seed !== undefined && (!Number.isSafeInteger(config.seed) || config.seed < 0)) throw new Error('seed must be a non-negative integer') }

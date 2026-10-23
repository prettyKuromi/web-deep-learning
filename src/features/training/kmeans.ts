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
        const clusters = centroids.map(() => [] as number[][])
        points.forEach((point, i) => clusters[assignments[i]].push(point))
        centroids.forEach((centroid, i) => {
          if (clusters[i].length) centroid.forEach((_, j) => { centroid[j] = stableMean(clusters[i].map(point => point[j])) })
        })
        const loss = stableMean(points.map((point, i) => squaredDistance(point, centroids[assignments[i]])))
        if (iteration === 0 || iteration === (config.iterations ?? 100) - 1) { const snapshot = { iteration: iteration + 1, loss }; snapshots.push(snapshot); emit?.(snapshot) }
      }
      return { model: { kind: 'k-means', centroids, dimensions }, snapshots }
    },
    predict(model, samples) { return samples.map(sample => { if (sample.length !== model.dimensions) throw new Error('sample dimensions do not match model'); return nearest(model.centroids, sample) }) },
  }
}
function nearest(centroids: readonly number[][], point: readonly number[]): number { return centroids.map(c => squaredDistance(c, point)).reduce((best, value, i, all) => value < all[best] ? i : best, 0) }
function squaredDistance(a: readonly number[], b: readonly number[]): number {
  let total = 0
  for (let i = 0; i < a.length; i++) {
    const difference = a[i] - b[i]
    const square = difference * difference
    total += square
    if (!Number.isFinite(difference) || !Number.isFinite(total)) throw new Error('特征范围过大，平方距离超出可表示范围')
  }
  return total
}
function stableMean(values: readonly number[]): number {
  const scale = values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0)
  if (scale === 0) return 0
  const normalized = values.reduce((sum, value) => sum + value / scale, 0) / values.length
  return Math.max(-1, Math.min(1, normalized)) * scale
}
function initializeCentroids(points: number[][], k: number, random: () => number): number[][] {
  const selected = [Math.floor(random() * points.length)]
  const used = Array(points.length).fill(false)
  used[selected[0]] = true
  const nearestDistances = points.map(point => squaredDistance(point, points[selected[0]]))
  while (selected.length < k) {
    const maximum = nearestDistances.reduce((best, distance) => Math.max(best, distance), 0)
    let next: number
    if (maximum === 0) {
      let remaining = Math.floor(random() * (points.length - selected.length))
      next = used.findIndex(isUsed => !isUsed && remaining-- === 0)
    } else {
      const total = nearestDistances.reduce((sum, distance) => sum + distance / maximum, 0)
      let target = random() * total
      next = nearestDistances.findIndex(distance => (target -= distance / maximum) < 0)
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

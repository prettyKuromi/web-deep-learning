import type { DbscanModel, DbscanTrainConfig, Trainer, TrainSnapshot } from './types'

export function createDbscanTrainer(): Trainer<DbscanTrainConfig, DbscanModel, number[]> {
  return {
    async train({ samples, epsilon = .3, minPoints = 5 }, emit) {
      if (!samples.length || epsilon <= 0 || minPoints < 1) throw new Error('DBSCAN 参数无效')
      const points = samples.map(row => [...row]); const assignments = Array(points.length).fill(-2); let cluster = 0
      const snapshots: TrainSnapshot[] = []
      const record = (iteration: number) => { const snapshot = { iteration, loss: assignments.filter(value => value === -2).length / points.length }; snapshots.push(snapshot); emit?.(snapshot) }
      for (let i = 0; i < points.length; i++) {
        if (assignments[i] === -2) {
          const neighbors = near(points, i, epsilon)
          if (neighbors.length < minPoints) assignments[i] = -1
          else {
            assignments[i] = cluster
            for (let cursor = 0; cursor < neighbors.length; cursor++) {
              const index = neighbors[cursor]
              if (assignments[index] === -1) assignments[index] = cluster
              if (assignments[index] !== -2) continue
              assignments[index] = cluster
              const next = near(points, index, epsilon)
              if (next.length >= minPoints) next.forEach(item => { if (!neighbors.includes(item)) neighbors.push(item) })
            }
            cluster++
          }
        }
        record(i + 1)
      }
      return { model: { kind: 'dbscan', samples: points, assignments, epsilon, dimensions: points[0].length }, snapshots }
    },
    predict(model, samples) { return samples.map(sample => { let best = -1; let distance = Infinity; model.samples.forEach((point, i) => { const next = squared(point, sample); if (next < distance) { distance = next; best = i } }); return distance <= model.epsilon ** 2 ? model.assignments[best] : -1 }) },
  }
}
function near(points: readonly number[][], index: number, epsilon: number) { return points.map((point, i) => squared(point, points[index]) <= epsilon ** 2 ? i : -1).filter(i => i >= 0) }
function squared(a: readonly number[], b: readonly number[]) { return a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0) }

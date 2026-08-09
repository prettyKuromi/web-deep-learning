import type { PcaModel, PcaTrainConfig, Trainer, TrainSnapshot } from './types'

export function createPcaTrainer(): Trainer<PcaTrainConfig, PcaModel, number[][]> {
  return {
    async train(config, emit) {
      validate(config)
      const dimensions = config.samples[0].length; const count = Math.min(config.components ?? dimensions, dimensions)
      const means = Array.from({ length: dimensions }, (_, j) => config.samples.reduce((sum, row) => sum + row[j], 0) / config.samples.length)
      const centered = config.samples.map(row => row.map((v, j) => v - means[j]))
      const covariance = Array.from({ length: dimensions }, (_, i) => Array.from({ length: dimensions }, (_, j) => centered.reduce((sum, row) => sum + row[i] * row[j], 0) / Math.max(1, centered.length - 1)))
      const components: number[][] = []; const explainedVariance: number[] = []; const total = covariance.reduce((sum, row, i) => sum + row[i], 0)
      const snapshots: TrainSnapshot[] = [{ iteration: 0, loss: total }]
      emit?.(snapshots[0])
      let matrix = covariance.map(row => [...row])
      for (let c = 0; c < count; c++) { let vector: number[] = Array.from({ length: dimensions }, (_, i) => i === c ? 1 : 0); for (let iteration = 0; iteration < 50; iteration++) { const next = matrix.map(row => row.reduce((sum, v, j) => sum + v * vector[j], 0)); const norm = Math.hypot(...next) || 1; vector = next.map(v => v / norm) } const value = vector.reduce((sum, v, i) => sum + v * matrix[i].reduce((s, m, j) => s + m * vector[j], 0), 0); components.push(vector); explainedVariance.push(total ? value / total : 0); matrix = matrix.map((row, i) => row.map((v, j) => v - value * vector[i] * vector[j])) }
      const residualVariance = Math.max(0, total * (1 - explainedVariance.reduce((sum, value) => sum + value, 0)))
      const snapshot: TrainSnapshot = { iteration: count, loss: residualVariance }
      snapshots.push(snapshot); emit?.(snapshot)
      return { model: { kind: 'pca', means, components, explainedVariance, dimensions }, snapshots }
    },
    predict(model, samples) { return samples.map(sample => { if (sample.length !== model.dimensions) throw new Error('sample dimensions do not match model'); const centered = sample.map((v, j) => v - model.means[j]); return model.components.map(component => component.reduce((sum, v, j) => sum + v * centered[j], 0)) }) },
  }
}
function validate(config: PcaTrainConfig): void { if (!config.samples.length) throw new Error('samples must be non-empty'); const dimensions = config.samples[0].length; if (!dimensions || config.samples.some(row => row.length !== dimensions || row.some(value => !Number.isFinite(value)))) throw new Error('samples must have consistent finite dimensions'); if (config.components !== undefined && (!Number.isInteger(config.components) || config.components < 1 || config.components > dimensions)) throw new Error('components must be valid') }

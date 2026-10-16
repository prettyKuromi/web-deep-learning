import type { FeatureMatrix, RegressionModel, RegressionTrainConfig, Trainer, TrainSnapshot } from './types'

export function createLinearRegressionTrainer(): Trainer<RegressionTrainConfig, RegressionModel, number[]> { return create(false) }
export function createRidgeRegressionTrainer(): Trainer<RegressionTrainConfig, RegressionModel, number[]> { return create(true) }

function create(ridge: boolean): Trainer<RegressionTrainConfig, RegressionModel, number[]> {
  return {
    async train(config, emit, control) {
      validate(config)
      const dimensions = config.samples[0].length
      const x = config.samples.map(row => [1, ...row])
      const weights = Array(dimensions + 1).fill(0)
      const rate = config.learningRate ?? 0.05
      const iterations = config.iterations ?? 300
      const regularization = ridge ? (config.regularization ?? 0.01) : 0
      const snapshots: TrainSnapshot[] = []
      for (let iteration = 0; iteration < iterations; iteration++) {
        await control?.checkpoint()
        const gradients = Array(dimensions + 1).fill(0)
        let loss = 0
        x.forEach((row, i) => { const error = dot(weights, row) - config.labels[i]; loss += error * error; row.forEach((v, j) => { gradients[j] += error * v }) })
        weights.forEach((_, j) => { gradients[j] = gradients[j] / x.length + (j === 0 ? 0 : regularization * weights[j]); weights[j] -= rate * gradients[j] })
        if (control || iteration === 0 || iteration === iterations - 1 || (iteration + 1) % Math.max(1, Math.floor(iterations / 10)) === 0) { const snapshot = { iteration: iteration + 1, loss: loss / (2 * x.length) }; snapshots.push(snapshot); emit?.(snapshot) }
      }
      return { model: { kind: ridge ? 'ridge-regression' : 'linear-regression', weights, dimensions }, snapshots }
    },
    predict(model, samples) { return samples.map(sample => { if (sample.length !== model.dimensions) throw new Error('sample dimensions do not match model'); return dot(model.weights, [1, ...sample]) }) },
  }
}

function dot(a: readonly number[], b: readonly number[]): number { return a.reduce((sum, value, i) => sum + value * b[i], 0) }
function validate(config: RegressionTrainConfig): void {
  if (!config.samples.length || config.samples.length !== config.labels.length) throw new Error('samples and labels must be non-empty and have equal length')
  const dimensions = config.samples[0].length
  if (!dimensions || config.samples.some(row => row.length !== dimensions || row.some(value => !Number.isFinite(value))) || config.labels.some(value => !Number.isFinite(value))) throw new Error('samples and labels must contain finite values with consistent dimensions')
  if (config.learningRate !== undefined && (!(config.learningRate > 0) || !Number.isFinite(config.learningRate))) throw new Error('learningRate must be positive')
  if (config.iterations !== undefined && (!Number.isInteger(config.iterations) || config.iterations < 1)) throw new Error('iterations must be a positive integer')
}

export type { FeatureMatrix }

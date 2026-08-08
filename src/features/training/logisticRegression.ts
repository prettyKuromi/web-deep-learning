import type { FeatureMatrix, Labels, LogisticRegressionModel, LogisticRegressionTrainConfig, Trainer, TrainSnapshot } from './types'

export function createLogisticRegressionTrainer(): Trainer<LogisticRegressionTrainConfig, LogisticRegressionModel> {
  return {
    async train(config, emit) {
      validate(config)
      const { samples, labels } = config
      const classes = [...new Set(labels)]
      const dimensions = samples[0].length
      const x = samples.map(row => [1, ...row])
      const weights = classes.map(() => Array(dimensions + 1).fill(0))
      const learningRate = config.learningRate ?? 0.1
      const iterations = config.iterations ?? 200
      const regularization = config.regularization ?? 0
      const snapshots: TrainSnapshot[] = []
      for (let iteration = 0; iteration < iterations; iteration++) {
        let loss = 0
        const gradients = weights.map(() => Array(dimensions + 1).fill(0))
        x.forEach((row, i) => {
          const scores = weights.map(weight => dot(weight, row))
          const max = Math.max(...scores)
          const exp = scores.map(score => Math.exp(score - max))
          const total = exp.reduce((a, b) => a + b, 0)
          const probs = exp.map(value => value / total)
          const target = classes.indexOf(labels[i])
          loss -= Math.log(Math.max(probs[target], 1e-12))
          probs.forEach((probability, classIndex) => row.forEach((value, j) => {
            gradients[classIndex][j] += (probability - (classIndex === target ? 1 : 0)) * value
          }))
        })
        weights.forEach((weight, classIndex) => weight.forEach((_, j) => {
          const penalty = j === 0 ? 0 : regularization * weight[j]
          weight[j] -= learningRate * (gradients[classIndex][j] / x.length + penalty)
        }))
        const snapshot = { iteration: iteration + 1, loss: loss / x.length }
        if (iteration === 0 || iteration === iterations - 1 || (iteration + 1) % Math.max(1, Math.floor(iterations / 10)) === 0) {
          snapshots.push(snapshot)
          emit?.(snapshot)
        }
      }
      return { model: { kind: 'logistic-regression', labels: classes, weights, dimensions }, snapshots }
    },
    predict(model, samples) {
      return samples.map(sample => {
        if (sample.length !== model.dimensions) throw new Error('sample dimensions do not match model')
        const row = [1, ...sample]
        const index = model.weights.map(weight => dot(weight, row)).reduce((best, score, i, scores) => score > scores[best] ? i : best, 0)
        return model.labels[index]
      })
    },
  }
}

function dot(a: readonly number[], b: readonly number[]): number { return a.reduce((sum, value, i) => sum + value * b[i], 0) }
function validate(config: LogisticRegressionTrainConfig): void {
  if (!config.samples.length || config.samples.length !== config.labels.length) throw new Error('samples and labels must be non-empty and have equal length')
  if (new Set(config.labels).size < 2) throw new Error('at least two classes are required')
  const dimensions = config.samples[0].length
  if (!dimensions || config.samples.some(row => row.length !== dimensions || row.some(value => !Number.isFinite(value)))) throw new Error('samples must have consistent finite dimensions')
  if (config.learningRate !== undefined && (!(config.learningRate > 0) || !Number.isFinite(config.learningRate))) throw new Error('learningRate must be positive')
  if (config.iterations !== undefined && (!Number.isInteger(config.iterations) || config.iterations < 1)) throw new Error('iterations must be a positive integer')
}

export type { FeatureMatrix, Labels }

import type { FeatureMatrix, Label, Labels, NaiveBayesModel, NaiveBayesTrainConfig, Trainer, TrainSnapshot } from './types'

export function createNaiveBayesTrainer(): Trainer<NaiveBayesTrainConfig, NaiveBayesModel> {
  return {
    async train(config, emit) {
      validate(config)
      const labels = [...new Set(config.labels)]
      const dimensions = config.samples[0].length
      const means = labels.map(label => { const rows = config.samples.filter((_, i) => config.labels[i] === label); return Array.from({ length: dimensions }, (_, j) => rows.reduce((sum, row) => sum + row[j], 0) / rows.length) })
      const variances = labels.map((label, c) => { const rows = config.samples.filter((_, i) => config.labels[i] === label); return Array.from({ length: dimensions }, (_, j) => Math.max(config.varianceSmoothing ?? 1e-9, rows.reduce((sum, row) => sum + (row[j] - means[c][j]) ** 2, 0) / rows.length)) })
      const priors = labels.map(label => config.labels.filter(value => value === label).length / config.labels.length)
      const snapshot: TrainSnapshot = { iteration: 1 }; emit?.(snapshot)
      return { model: { kind: 'naive-bayes', labels, means, variances, priors, dimensions }, snapshots: [snapshot] }
    },
    predict(model, samples) { return samples.map(sample => { if (sample.length !== model.dimensions) throw new Error('sample dimensions do not match model'); let best = 0; let bestScore = -Infinity; model.labels.forEach((_, c) => { let score = Math.log(model.priors[c]); sample.forEach((value, j) => { const variance = model.variances[c][j]; score -= 0.5 * Math.log(2 * Math.PI * variance) + (value - model.means[c][j]) ** 2 / (2 * variance) }); if (score > bestScore) { best = c; bestScore = score } }); return model.labels[best] }) },
  }
}
function validate(config: NaiveBayesTrainConfig): void { if (!config.samples.length || config.samples.length !== config.labels.length) throw new Error('samples and labels must be non-empty and have equal length'); if (new Set(config.labels).size < 2) throw new Error('at least two classes are required'); const dimensions = config.samples[0].length; if (!dimensions || config.samples.some(row => row.length !== dimensions || row.some(value => !Number.isFinite(value)))) throw new Error('samples must have consistent finite dimensions') }
export type { FeatureMatrix, Label, Labels }

import type { MlpModel, MlpTrainConfig, Trainer, TrainSnapshot } from './types'

type Activation = NonNullable<MlpTrainConfig['activation']>

export function createMlpTrainer(): Trainer<MlpTrainConfig, MlpModel> {
  return {
    async train(config, emit, control) {
      validate(config)
      const activation = config.activation ?? 'relu'
      const seed = config.seed ?? 1
      const rng = random(seed)
      const labels = [...new Set(config.labels)]
      const dimensions = config.samples[0].length
      const split = config.validationSplit ?? 0
      const validationCount = split > 0 ? Math.max(1, Math.floor(config.samples.length * split)) : 0
      const trainCount = config.samples.length - validationCount
      const trainIndices = Array.from({ length: trainCount }, (_, i) => i)
      const means = config.normalize === false ? undefined : Array.from({ length: dimensions }, (_, j) => trainIndices.reduce((s, i) => s + config.samples[i][j], 0) / trainCount)
      const scales = means ? means.map((mean, j) => Math.sqrt(trainIndices.reduce((s, i) => s + (config.samples[i][j] - mean) ** 2, 0) / trainCount) || 1) : undefined
      const normalize = (row: readonly number[]) => means ? row.map((v, j) => (v - means[j]) / (scales?.[j] ?? 1)) : [...row]
      const data = config.samples.map(normalize)
      const hidden = config.hiddenLayers ?? [16, 16]
      const layers = [dimensions, ...hidden, labels.length]
      const weights = layers.slice(1).map((out, li) => Array.from({ length: out }, () => Array.from({ length: layers[li] }, () => (rng() * 2 - 1) * Math.sqrt(2 / layers[li]))))
      const biases = layers.slice(1).map(out => Array(out).fill(0))
      const learningRate = config.learningRate ?? 0.01
      const epochs = config.epochs ?? 100
      const batchSize = config.batchSize ?? 32
      const snapshots: TrainSnapshot[] = []
      for (let epoch = 0; epoch < epochs; epoch++) {
        await control?.checkpoint()
        const order = [...trainIndices]
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
        for (let start = 0; start < order.length; start += batchSize) {
          await control?.yield?.()
          const batch = order.slice(start, start + batchSize)
          const gw = weights.map(layer => layer.map(row => Array(row.length).fill(0)))
          const gb = biases.map(layer => Array(layer.length).fill(0))
          for (const index of batch) {
            const { activations, pre } = forward(data[index], weights, biases, activation)
            const target = labels.indexOf(config.labels[index])
            const delta = activations[activations.length - 1].map((v, k) => v - (k === target ? 1 : 0))
            for (let li = weights.length - 1; li >= 0; li--) {
              const input = activations[li]
              delta.forEach((d, oi) => { gb[li][oi] += d; input.forEach((v, ii) => { gw[li][oi][ii] += d * v }) })
              if (li > 0) {
                const next = Array(layers[li]).fill(0)
                delta.forEach((d, oi) => weights[li][oi].forEach((w, ii) => { next[ii] += d * w }))
                for (let ii = 0; ii < next.length; ii++) next[ii] *= derivative(pre[li - 1][ii], activation)
                delta.splice(0, delta.length, ...next)
              }
            }
          }
          const rate = learningRate / batch.length
          weights.forEach((layer, li) => layer.forEach((row, oi) => row.forEach((_, ii) => { row[ii] -= rate * gw[li][oi][ii] })))
          biases.forEach((layer, li) => layer.forEach((_, oi) => { layer[oi] -= rate * gb[li][oi] }))
        }
        const loss = trainIndices.reduce((sum, i) => { const out = forward(data[i], weights, biases, activation).activations.at(-1)!; return sum - Math.log(Math.max(out[labels.indexOf(config.labels[i])], 1e-12)) }, 0) / trainCount
        const snapshot = { iteration: epoch + 1, loss }
        if (control || epoch === 0 || epoch === epochs - 1 || (epoch + 1) % Math.max(1, Math.floor(epochs / 10)) === 0) { snapshots.push(snapshot); emit?.(snapshot) }
      }
      return { model: { kind: 'mlp', labels, layers, activation, weights, biases, means, scales, seed }, snapshots }
    },
    predict(model, samples) {
      return samples.map(sample => {
        if (sample.length !== model.layers[0]) throw new Error('sample dimensions do not match model')
        const row = model.means ? sample.map((v, j) => (v - model.means![j]) / (model.scales?.[j] ?? 1)) : sample
        const out = forward(row, model.weights, model.biases, model.activation).activations.at(-1)!
        return model.labels[out.reduce((best, v, i, arr) => v > arr[best] ? i : best, 0)]
      })
    },
  }
}

function forward(input: readonly number[], weights: number[][][], biases: number[][], activation: Activation) {
  const activations: number[][] = [[...input]]; const pre: number[][] = []
  for (let li = 0; li < weights.length; li++) {
    const z = weights[li].map((row, oi) => row.reduce((s, w, ii) => s + w * activations[li][ii], biases[li][oi])); pre.push(z)
    activations.push(li === weights.length - 1 ? softmax(z) : z.map(v => activate(v, activation)))
  }
  return { activations, pre }
}
function activate(x: number, a: Activation) { return a === 'relu' ? Math.max(0, x) : a === 'tanh' ? Math.tanh(x) : 1 / (1 + Math.exp(-x)) }
function derivative(x: number, a: Activation) { return a === 'relu' ? (x > 0 ? 1 : 0) : a === 'tanh' ? 1 - Math.tanh(x) ** 2 : (1 / (1 + Math.exp(-x))) * (1 - 1 / (1 + Math.exp(-x))) }
function softmax(values: readonly number[]) { const max = Math.max(...values); const exps = values.map(v => Math.exp(v - max)); const total = exps.reduce((s, v) => s + v, 0); return exps.map(v => v / total) }
function random(seed: number) { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 } }
function validate(config: MlpTrainConfig) {
  if (!config.samples.length || config.samples.length !== config.labels.length) throw new Error('samples and labels must be non-empty and have equal length')
  if (new Set(config.labels).size < 2) throw new Error('at least two classes are required')
  const dimensions = config.samples[0].length
  if (!dimensions || config.samples.some(row => row.length !== dimensions || row.some(v => !Number.isFinite(v)))) throw new Error('samples must have consistent finite dimensions')
  if (config.hiddenLayers?.some(v => !Number.isInteger(v) || v < 1)) throw new Error('hiddenLayers must contain positive integers')
  if (config.learningRate !== undefined && (!(config.learningRate > 0) || !Number.isFinite(config.learningRate))) throw new Error('learningRate must be positive')
  if (config.epochs !== undefined && (!Number.isInteger(config.epochs) || config.epochs < 1)) throw new Error('epochs must be a positive integer')
  if (config.batchSize !== undefined && (!Number.isInteger(config.batchSize) || config.batchSize < 1)) throw new Error('batchSize must be a positive integer')
  if (config.validationSplit !== undefined && (!Number.isFinite(config.validationSplit) || config.validationSplit < 0 || config.validationSplit >= 1)) throw new Error('validationSplit must be between 0 and 1')
}

export type { MlpModel, MlpTrainConfig }

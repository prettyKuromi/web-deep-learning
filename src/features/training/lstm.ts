import type { FeatureMatrix, Label, Labels, Trainer, TrainSnapshot } from './types'

export interface LstmSequenceShape {
  steps: number
  channels: number
}

export interface LstmTrainConfig {
  samples: FeatureMatrix
  labels: Labels
  sequenceShape: LstmSequenceShape
  hiddenSize?: number
  learningRate?: number
  epochs?: number
  batchSize?: number
  seed?: number
}

export interface LstmModel {
  kind: 'lstm'
  labels: Label[]
  sequenceShape: LstmSequenceShape
  hiddenSize: number
  inputWeights: number[][]
  recurrentWeights: number[][]
  gateBiases: number[]
  outputWeights: number[][]
  outputBiases: number[]
  seed: number
}

interface ForwardCache {
  input: readonly number[]
  previousHidden: number[]
  previousCell: number[]
  inputGate: number[]
  forgetGate: number[]
  outputGate: number[]
  candidate: number[]
  cell: number[]
  hidden: number[]
}

interface ForwardResult {
  probabilities: number[]
  hidden: number[]
  cache: ForwardCache[]
}

interface Gradients {
  inputWeights: number[][]
  recurrentWeights: number[][]
  gateBiases: number[]
  outputWeights: number[][]
  outputBiases: number[]
}

const defaults = { hiddenSize: 8, learningRate: 0.05, epochs: 80, batchSize: 16, seed: 1 }

export function createLstmTrainer(): Trainer<LstmTrainConfig, LstmModel> {
  return {
    async train(config, emit, control) {
      validate(config)
      const labels = [...new Set(config.labels)]
      const shape = { ...config.sequenceShape }
      const hiddenSize = config.hiddenSize ?? defaults.hiddenSize
      const seed = config.seed ?? defaults.seed
      const random = createRandom(seed)
      const model = initialize(labels, shape, hiddenSize, seed, random)
      const learningRate = config.learningRate ?? defaults.learningRate
      const epochs = config.epochs ?? defaults.epochs
      const batchSize = config.batchSize ?? defaults.batchSize
      const snapshots: TrainSnapshot[] = []

      for (let epoch = 0; epoch < epochs; epoch += 1) {
        await control?.checkpoint()
        const order = config.samples.map((_, index) => index)
        shuffle(order, random)
        for (let start = 0; start < order.length; start += batchSize) {
          await control?.yield?.()
          const batch = order.slice(start, start + batchSize)
          const gradients = zeroGradients(model)
          for (const index of batch) {
            accumulateGradients(
              model,
              config.samples[index],
              labels.indexOf(config.labels[index]),
              gradients,
            )
          }
          applyGradients(model, gradients, learningRate / batch.length)
        }

        const loss = config.samples.reduce((total, sample, index) => {
          const probabilities = forward(model, sample).probabilities
          return total - Math.log(Math.max(probabilities[labels.indexOf(config.labels[index])], 1e-12))
        }, 0) / config.samples.length
        const snapshot: TrainSnapshot = { iteration: epoch + 1, step: epoch + 1, unit: 'epoch', epoch: epoch + 1, loss }
        snapshots.push(snapshot)
        emit?.(snapshot)
      }

      return { model, snapshots }
    },
    predict(model, samples) {
      const size = model.sequenceShape.steps * model.sequenceShape.channels
      return samples.map(sample => {
        if (sample.length !== size || sample.some(value => !Number.isFinite(value))) {
          throw new Error('sample dimension must match the sequence shape and contain finite values')
        }
        const probabilities = forward(model, sample).probabilities
        return model.labels[argMax(probabilities)]
      })
    },
  }
}

function initialize(labels: Label[], sequenceShape: LstmSequenceShape, hiddenSize: number, seed: number, random: () => number): LstmModel {
  const channels = sequenceShape.channels
  const gates = hiddenSize * 4
  const inputWeights = Array.from({ length: gates }, () => Array.from({ length: channels }, () => uniform(random, Math.sqrt(6 / (channels + hiddenSize)))))
  const recurrentWeights = Array.from({ length: gates }, () => Array.from({ length: hiddenSize }, () => uniform(random, Math.sqrt(6 / (hiddenSize * 2)))))
  const gateBiases = Array(gates).fill(0)
  for (let unit = 0; unit < hiddenSize; unit += 1) gateBiases[hiddenSize + unit] = 1
  const outputWeights = Array.from({ length: labels.length }, () => Array.from({ length: hiddenSize }, () => uniform(random, Math.sqrt(6 / (hiddenSize + labels.length)))))
  const outputBiases = Array(labels.length).fill(0)
  return { kind: 'lstm', labels, sequenceShape, hiddenSize, inputWeights, recurrentWeights, gateBiases, outputWeights, outputBiases, seed }
}

function forward(model: LstmModel, sample: readonly number[]): ForwardResult {
  const { steps, channels } = model.sequenceShape
  const hiddenSize = model.hiddenSize
  let hidden = Array(hiddenSize).fill(0) as number[]
  let cell = Array(hiddenSize).fill(0) as number[]
  const cache: ForwardCache[] = []
  for (let step = 0; step < steps; step += 1) {
    const input = sample.slice(step * channels, (step + 1) * channels)
    const previousHidden = hidden
    const previousCell = cell
    const inputGate = gate(model, input, previousHidden, 0, sigmoid)
    const forgetGate = gate(model, input, previousHidden, hiddenSize, sigmoid)
    const outputGate = gate(model, input, previousHidden, hiddenSize * 2, sigmoid)
    const candidate = gate(model, input, previousHidden, hiddenSize * 3, Math.tanh)
    cell = cell.map((value, unit) => forgetGate[unit] * value + inputGate[unit] * candidate[unit])
    hidden = cell.map((value, unit) => outputGate[unit] * Math.tanh(value))
    cache.push({ input, previousHidden, previousCell, inputGate, forgetGate, outputGate, candidate, cell, hidden })
  }
  const logits = model.outputWeights.map((weights, index) => dot(weights, hidden) + model.outputBiases[index])
  return { probabilities: softmax(logits), hidden, cache }
}

function gate(model: LstmModel, input: readonly number[], hidden: readonly number[], offset: number, activation: (value: number) => number): number[] {
  const size = model.hiddenSize
  return Array.from({ length: size }, (_, unit) => {
    const index = offset + unit
    return activation(dot(model.inputWeights[index], input) + dot(model.recurrentWeights[index], hidden) + model.gateBiases[index])
  })
}

function accumulateGradients(model: LstmModel, sample: readonly number[], target: number, gradients: Gradients): void {
  const { probabilities, hidden, cache } = forward(model, sample)
  let hiddenGradient = Array(model.hiddenSize).fill(0) as number[]
  for (let classIndex = 0; classIndex < probabilities.length; classIndex += 1) {
    const delta = probabilities[classIndex] - Number(classIndex === target)
    gradients.outputBiases[classIndex] += delta
    for (let unit = 0; unit < model.hiddenSize; unit += 1) {
      gradients.outputWeights[classIndex][unit] += delta * hidden[unit]
      hiddenGradient[unit] += delta * model.outputWeights[classIndex][unit]
    }
  }

  let cellGradient = Array(model.hiddenSize).fill(0) as number[]
  for (let step = cache.length - 1; step >= 0; step -= 1) {
    const state = cache[step]
    const inputPreGradient = Array(model.hiddenSize).fill(0) as number[]
    const forgetPreGradient = Array(model.hiddenSize).fill(0) as number[]
    const outputPreGradient = Array(model.hiddenSize).fill(0) as number[]
    const candidatePreGradient = Array(model.hiddenSize).fill(0) as number[]
    const previousCellGradient = Array(model.hiddenSize).fill(0) as number[]
    const previousHiddenGradient = Array(model.hiddenSize).fill(0) as number[]

    for (let unit = 0; unit < model.hiddenSize; unit += 1) {
      const tanhCell = Math.tanh(state.cell[unit])
      const totalCellGradient = cellGradient[unit] + hiddenGradient[unit] * state.outputGate[unit] * (1 - tanhCell * tanhCell)
      inputPreGradient[unit] = totalCellGradient * state.candidate[unit] * state.inputGate[unit] * (1 - state.inputGate[unit])
      forgetPreGradient[unit] = totalCellGradient * state.previousCell[unit] * state.forgetGate[unit] * (1 - state.forgetGate[unit])
      outputPreGradient[unit] = hiddenGradient[unit] * tanhCell * state.outputGate[unit] * (1 - state.outputGate[unit])
      candidatePreGradient[unit] = totalCellGradient * state.inputGate[unit] * (1 - state.candidate[unit] * state.candidate[unit])
      previousCellGradient[unit] = totalCellGradient * state.forgetGate[unit]
    }

    const gateGradients = [inputPreGradient, forgetPreGradient, outputPreGradient, candidatePreGradient]
    gateGradients.forEach((values, gateIndex) => values.forEach((value, unit) => {
      const index = gateIndex * model.hiddenSize + unit
      gradients.gateBiases[index] += value
      state.input.forEach((feature, channel) => { gradients.inputWeights[index][channel] += value * feature })
      state.previousHidden.forEach((feature, previousUnit) => {
        gradients.recurrentWeights[index][previousUnit] += value * feature
        previousHiddenGradient[previousUnit] += value * model.recurrentWeights[index][previousUnit]
      })
    }))
    hiddenGradient = previousHiddenGradient
    cellGradient = previousCellGradient
  }
}

function zeroGradients(model: LstmModel): Gradients {
  return {
    inputWeights: model.inputWeights.map(row => row.map(() => 0)),
    recurrentWeights: model.recurrentWeights.map(row => row.map(() => 0)),
    gateBiases: model.gateBiases.map(() => 0),
    outputWeights: model.outputWeights.map(row => row.map(() => 0)),
    outputBiases: model.outputBiases.map(() => 0),
  }
}

function applyGradients(model: LstmModel, gradients: Gradients, rate: number): void {
  model.inputWeights.forEach((row, index) => row.forEach((_, column) => { row[column] -= rate * gradients.inputWeights[index][column] }))
  model.recurrentWeights.forEach((row, index) => row.forEach((_, column) => { row[column] -= rate * gradients.recurrentWeights[index][column] }))
  model.gateBiases.forEach((_, index) => { model.gateBiases[index] -= rate * gradients.gateBiases[index] })
  model.outputWeights.forEach((row, index) => row.forEach((_, column) => { row[column] -= rate * gradients.outputWeights[index][column] }))
  model.outputBiases.forEach((_, index) => { model.outputBiases[index] -= rate * gradients.outputBiases[index] })
}

function validate(config: LstmTrainConfig): void {
  if (!config.samples.length || config.samples.length !== config.labels.length) {
    throw new Error('samples and labels must be non-empty and have equal length')
  }
  if (new Set(config.labels).size < 2) throw new Error('at least two classes are required')
  const { steps, channels } = config.sequenceShape ?? {} as LstmSequenceShape
  if (!Number.isSafeInteger(steps) || steps < 1 || !Number.isSafeInteger(channels) || channels < 1) {
    throw new Error('sequence steps and channels must be positive integers')
  }
  const dimensions = steps * channels
  if (!Number.isSafeInteger(dimensions) || config.samples.some(sample => sample.length !== dimensions)) {
    throw new Error('sample dimensions must match steps times channels')
  }
  if (config.samples.some(sample => sample.some(value => !Number.isFinite(value)))) {
    throw new Error('samples must contain finite features')
  }
  if (config.hiddenSize !== undefined && (!Number.isSafeInteger(config.hiddenSize) || config.hiddenSize < 1)) {
    throw new Error('hiddenSize must be a positive integer')
  }
  if (config.learningRate !== undefined && (!(config.learningRate > 0) || !Number.isFinite(config.learningRate))) {
    throw new Error('learningRate must be positive and finite')
  }
  if (config.epochs !== undefined && (!Number.isSafeInteger(config.epochs) || config.epochs < 1)) {
    throw new Error('epochs must be a positive integer')
  }
  if (config.batchSize !== undefined && (!Number.isSafeInteger(config.batchSize) || config.batchSize < 1)) {
    throw new Error('batchSize must be a positive integer')
  }
  if (config.seed !== undefined && !Number.isSafeInteger(config.seed)) throw new Error('seed must be a finite integer')
}

function createRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function shuffle(values: number[], random: () => number): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }
}

function uniform(random: () => number, limit: number): number {
  return (random() * 2 - 1) * limit
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function softmax(values: readonly number[]): number[] {
  const maximum = Math.max(...values)
  const exponents = values.map(value => Math.exp(value - maximum))
  const total = exponents.reduce((sum, value) => sum + value, 0)
  return exponents.map(value => value / total)
}

function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, index) => sum + value * b[index], 0)
}

function argMax(values: readonly number[]): number {
  return values.reduce((best, value, index) => value > values[best] ? index : best, 0)
}

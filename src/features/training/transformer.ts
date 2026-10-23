import type { FeatureMatrix, Label, Labels, Trainer, TrainSnapshot } from './types'

export interface TransformerSequenceShape {
  steps: number
  channels: number
}

export interface TransformerTrainConfig {
  samples: FeatureMatrix
  labels: Labels
  sequenceShape: TransformerSequenceShape
  modelDimension?: number
  attentionHeads?: number
  feedForwardSize?: number
  learningRate?: number
  epochs?: number
  batchSize?: number
  seed?: number
}

export interface TransformerModel {
  kind: 'transformer'
  labels: Label[]
  sequenceShape: TransformerSequenceShape
  modelDimension: number
  attentionHeads: number
  feedForwardSize: number
  inputWeights: number[][]
  inputBias: number[]
  queryWeights: number[][]
  queryBias: number[]
  keyWeights: number[][]
  keyBias: number[]
  valueWeights: number[][]
  valueBias: number[]
  attentionOutputWeights: number[][]
  attentionOutputBias: number[]
  norm1Scale: number[]
  norm1Bias: number[]
  feedForwardWeights: number[][]
  feedForwardBias: number[]
  projectionWeights: number[][]
  projectionBias: number[]
  norm2Scale: number[]
  norm2Bias: number[]
  outputWeights: number[][]
  outputBias: number[]
  seed: number
}

interface LayerNormCache {
  normalized: number[][]
  inverseStd: number[]
}

interface ForwardCache {
  sample: readonly number[]
  embeddings: number[][]
  query: number[][]
  key: number[][]
  value: number[][]
  attentionWeights: number[][][]
  context: number[][]
  norm1Input: number[][]
  norm1: number[][]
  norm1Cache: LayerNormCache
  feedForwardHidden: number[][]
  norm2Input: number[][]
  norm2: number[][]
  norm2Cache: LayerNormCache
}

type Gradients = Omit<TransformerModel, 'kind' | 'labels' | 'sequenceShape' | 'modelDimension' | 'attentionHeads' | 'feedForwardSize' | 'seed'>

const defaults = { modelDimension: 8, attentionHeads: 2, feedForwardSize: 16, learningRate: 0.02, epochs: 80, batchSize: 16, seed: 1 }
const layerNormEpsilon = 1e-5

export function createTransformerTrainer(): Trainer<TransformerTrainConfig, TransformerModel> {
  return {
    async train(config, emit, control) {
      validate(config)
      const labels = [...new Set(config.labels)]
      const shape = { ...config.sequenceShape }
      const seed = config.seed ?? defaults.seed
      const random = createRandom(seed)
      const model = initialize(
        labels,
        shape,
        config.modelDimension ?? defaults.modelDimension,
        config.attentionHeads ?? defaults.attentionHeads,
        config.feedForwardSize ?? defaults.feedForwardSize,
        seed,
        random,
      )
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
            const result = forward(model, config.samples[index])
            accumulateGradients(model, result.cache, result.probabilities, labels.indexOf(config.labels[index]), gradients)
          }
          applyGradients(model, gradients, learningRate / batch.length)
          if (!hasFiniteParameters(model)) throw new Error('Transformer 训练更新产生非有限数值，已停止')
        }

        const loss = config.samples.reduce((total, sample, index) => {
          const probabilities = forward(model, sample).probabilities
          return total - Math.log(Math.max(probabilities[labels.indexOf(config.labels[index])], 1e-12))
        }, 0) / config.samples.length
        if (!Number.isFinite(loss)) throw new Error('Transformer 训练损失不是有限数值，已停止')
        const snapshot: TrainSnapshot = {
          iteration: epoch + 1,
          step: epoch + 1,
          unit: 'epoch',
          epoch: epoch + 1,
          loss,
        }
        snapshots.push(snapshot)
        emit?.(snapshot)
      }
      return { model, snapshots }
    },
    predict(model, samples) {
      const dimensions = model.sequenceShape.steps * model.sequenceShape.channels
      return samples.map(sample => {
        if (sample.length !== dimensions || sample.some(value => !Number.isFinite(value))) {
          throw new Error('sample dimensions must match the sequence shape and contain finite values')
        }
        return model.labels[argMax(forward(model, sample).probabilities)]
      })
    },
  }
}

function initialize(
  labels: Label[],
  sequenceShape: TransformerSequenceShape,
  modelDimension: number,
  attentionHeads: number,
  feedForwardSize: number,
  seed: number,
  random: () => number,
): TransformerModel {
  const channels = sequenceShape.channels
  const denseLimit = Math.sqrt(6 / (modelDimension * 2))
  return {
    kind: 'transformer',
    labels,
    sequenceShape,
    modelDimension,
    attentionHeads,
    feedForwardSize,
    inputWeights: randomMatrix(modelDimension, channels, random, Math.sqrt(6 / (modelDimension + channels))),
    inputBias: zeros(modelDimension),
    queryWeights: randomMatrix(modelDimension, modelDimension, random, denseLimit),
    queryBias: zeros(modelDimension),
    keyWeights: randomMatrix(modelDimension, modelDimension, random, denseLimit),
    keyBias: zeros(modelDimension),
    valueWeights: randomMatrix(modelDimension, modelDimension, random, denseLimit),
    valueBias: zeros(modelDimension),
    attentionOutputWeights: randomMatrix(modelDimension, modelDimension, random, denseLimit),
    attentionOutputBias: zeros(modelDimension),
    norm1Scale: Array(modelDimension).fill(1),
    norm1Bias: zeros(modelDimension),
    feedForwardWeights: randomMatrix(feedForwardSize, modelDimension, random, Math.sqrt(6 / (modelDimension + feedForwardSize))),
    feedForwardBias: zeros(feedForwardSize),
    projectionWeights: randomMatrix(modelDimension, feedForwardSize, random, Math.sqrt(6 / (feedForwardSize + modelDimension))),
    projectionBias: zeros(modelDimension),
    norm2Scale: Array(modelDimension).fill(1),
    norm2Bias: zeros(modelDimension),
    outputWeights: randomMatrix(labels.length, modelDimension, random, Math.sqrt(6 / (modelDimension + labels.length))),
    outputBias: zeros(labels.length),
    seed,
  }
}

function forward(model: TransformerModel, sample: readonly number[]): { probabilities: number[]; cache: ForwardCache } {
  const { steps, channels } = model.sequenceShape
  const dimensions = model.modelDimension
  const embeddings = Array.from({ length: steps }, (_, step) => {
    const projected = linear(sample.slice(step * channels, (step + 1) * channels), model.inputWeights, model.inputBias)
    return projected.map((value, dimension) => value + positionalEncoding(step, dimension, dimensions))
  })
  const query = linearRows(embeddings, model.queryWeights, model.queryBias)
  const key = linearRows(embeddings, model.keyWeights, model.keyBias)
  const value = linearRows(embeddings, model.valueWeights, model.valueBias)
  const attentionWeights: number[][][] = []
  const context = Array.from({ length: steps }, () => zeros(dimensions))
  const headSize = dimensions / model.attentionHeads
  const scale = 1 / Math.sqrt(headSize)
  for (let head = 0; head < model.attentionHeads; head += 1) {
    const start = head * headSize
    const headWeights: number[][] = []
    for (let queryIndex = 0; queryIndex < steps; queryIndex += 1) {
      const scores = key.map(row => dot(query[queryIndex].slice(start, start + headSize), row.slice(start, start + headSize)) * scale)
      const weights = softmax(scores)
      headWeights.push(weights)
      weights.forEach((weight, keyIndex) => {
        for (let dimension = start; dimension < start + headSize; dimension += 1) {
          context[queryIndex][dimension] += weight * value[keyIndex][dimension]
        }
      })
    }
    attentionWeights.push(headWeights)
  }
  const attended = linearRows(context, model.attentionOutputWeights, model.attentionOutputBias)
  const norm1Input = embeddings.map((row, step) => row.map((value, dimension) => value + attended[step][dimension]))
  const norm1Result = layerNormalize(norm1Input, model.norm1Scale, model.norm1Bias)
  const feedForwardHidden = norm1Result.values.map(row => linear(row, model.feedForwardWeights, model.feedForwardBias).map(value => Math.max(0, value)))
  const feedForwardOutput = linearRows(feedForwardHidden, model.projectionWeights, model.projectionBias)
  const norm2Input = norm1Result.values.map((row, step) => row.map((value, dimension) => value + feedForwardOutput[step][dimension]))
  const norm2Result = layerNormalize(norm2Input, model.norm2Scale, model.norm2Bias)
  const pooled = zeros(dimensions)
  norm2Result.values.forEach(row => row.forEach((value, dimension) => { pooled[dimension] += value / steps }))
  const logits = linear(pooled, model.outputWeights, model.outputBias)
  const probabilities = softmax(logits)
  if (!probabilities.every(Number.isFinite)) throw new Error('Transformer 计算产生非有限数值，已停止')
  return {
    probabilities,
    cache: {
      sample,
      embeddings,
      query,
      key,
      value,
      attentionWeights,
      context,
      norm1Input,
      norm1: norm1Result.values,
      norm1Cache: norm1Result.cache,
      feedForwardHidden,
      norm2Input,
      norm2: norm2Result.values,
      norm2Cache: norm2Result.cache,
    },
  }
}

function accumulateGradients(
  model: TransformerModel,
  cache: ForwardCache,
  probabilities: number[],
  target: number,
  gradients: Gradients,
): void {
  const steps = model.sequenceShape.steps
  const dimensions = model.modelDimension
  const logitGradient = probabilities.map((probability, index) => probability - Number(index === target))
  const pooledGradient = zeros(dimensions)
  logitGradient.forEach((value, output) => {
    gradients.outputBias[output] += value
    const pooled = zeros(dimensions)
    cache.norm2.forEach(row => row.forEach((item, dimension) => { pooled[dimension] += item / steps }))
    model.outputWeights[output].forEach((weight, dimension) => {
      gradients.outputWeights[output][dimension] += value * pooled[dimension]
      pooledGradient[dimension] += weight * value
    })
  })
  const norm2Gradient = Array.from({ length: steps }, () => pooledGradient.map(value => value / steps))
  const norm2InputGradient = layerNormBackward(
    cache.norm2Input,
    cache.norm2Cache,
    norm2Gradient,
    model.norm2Scale,
    gradients.norm2Scale,
    gradients.norm2Bias,
  )

  const norm1Gradient = norm2InputGradient.map(row => [...row])
  const feedForwardHiddenGradient = Array.from({ length: steps }, () => zeros(model.feedForwardSize))
  for (let step = 0; step < steps; step += 1) {
    for (let output = 0; output < dimensions; output += 1) {
      const delta = norm2InputGradient[step][output]
      gradients.projectionBias[output] += delta
      for (let hidden = 0; hidden < model.feedForwardSize; hidden += 1) {
        gradients.projectionWeights[output][hidden] += delta * cache.feedForwardHidden[step][hidden]
        feedForwardHiddenGradient[step][hidden] += model.projectionWeights[output][hidden] * delta
      }
    }
    for (let hidden = 0; hidden < model.feedForwardSize; hidden += 1) {
      if (cache.feedForwardHidden[step][hidden] <= 0) continue
      const delta = feedForwardHiddenGradient[step][hidden]
      gradients.feedForwardBias[hidden] += delta
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        gradients.feedForwardWeights[hidden][dimension] += delta * cache.norm1[step][dimension]
        norm1Gradient[step][dimension] += model.feedForwardWeights[hidden][dimension] * delta
      }
    }
  }
  const norm1InputGradient = layerNormBackward(
    cache.norm1Input,
    cache.norm1Cache,
    norm1Gradient,
    model.norm1Scale,
    gradients.norm1Scale,
    gradients.norm1Bias,
  )
  const contextGradient = linearBackward(
    cache.context,
    model.attentionOutputWeights,
    norm1InputGradient,
    gradients.attentionOutputWeights,
    gradients.attentionOutputBias,
  )
  const queryGradient = Array.from({ length: steps }, () => zeros(dimensions))
  const keyGradient = Array.from({ length: steps }, () => zeros(dimensions))
  const valueGradient = Array.from({ length: steps }, () => zeros(dimensions))
  const headSize = dimensions / model.attentionHeads
  const scale = 1 / Math.sqrt(headSize)
  for (let head = 0; head < model.attentionHeads; head += 1) {
    const start = head * headSize
    for (let queryIndex = 0; queryIndex < steps; queryIndex += 1) {
      const weights = cache.attentionWeights[head][queryIndex]
      const weightGradient = weights.map((_, keyIndex) =>
        dot(contextGradient[queryIndex].slice(start, start + headSize), cache.value[keyIndex].slice(start, start + headSize)),
      )
      const average = dot(weights, weightGradient)
      for (let keyIndex = 0; keyIndex < steps; keyIndex += 1) {
        const scoreGradient = weights[keyIndex] * (weightGradient[keyIndex] - average)
        for (let dimension = start; dimension < start + headSize; dimension += 1) {
          valueGradient[keyIndex][dimension] += weights[keyIndex] * contextGradient[queryIndex][dimension]
          queryGradient[queryIndex][dimension] += scoreGradient * cache.key[keyIndex][dimension] * scale
          keyGradient[keyIndex][dimension] += scoreGradient * cache.query[queryIndex][dimension] * scale
        }
      }
    }
  }
  const embeddingGradient = norm1InputGradient.map(row => [...row])
  for (const [weightName, biasName, outputGradient] of [
    ['queryWeights', 'queryBias', queryGradient],
    ['keyWeights', 'keyBias', keyGradient],
    ['valueWeights', 'valueBias', valueGradient],
  ] as const) {
    const inputGradient = linearBackward(
      cache.embeddings,
      model[weightName],
      outputGradient,
      gradients[weightName],
      gradients[biasName],
    )
    inputGradient.forEach((row, step) => row.forEach((value, dimension) => { embeddingGradient[step][dimension] += value }))
  }
  const channels = model.sequenceShape.channels
  for (let step = 0; step < steps; step += 1) {
    for (let output = 0; output < dimensions; output += 1) {
      const delta = embeddingGradient[step][output]
      gradients.inputBias[output] += delta
      for (let channel = 0; channel < channels; channel += 1) {
        gradients.inputWeights[output][channel] += delta * cache.sample[step * channels + channel]
      }
    }
  }
}

function layerNormalize(rows: number[][], scale: number[], bias: number[]) {
  const normalized: number[][] = []
  const values: number[][] = []
  const inverseStd: number[] = []
  for (const row of rows) {
    const average = row.reduce((sum, value) => sum + value, 0) / row.length
    const variance = row.reduce((sum, value) => sum + (value - average) ** 2, 0) / row.length
    const inverse = 1 / Math.sqrt(variance + layerNormEpsilon)
    const normalizedRow = row.map(value => (value - average) * inverse)
    normalized.push(normalizedRow)
    values.push(normalizedRow.map((value, dimension) => value * scale[dimension] + bias[dimension]))
    inverseStd.push(inverse)
  }
  return { values, cache: { normalized, inverseStd } }
}

function layerNormBackward(
  inputs: number[][],
  cache: LayerNormCache,
  outputGradient: number[][],
  scale: number[],
  scaleGradient: number[],
  biasGradient: number[],
): number[][] {
  const dimensions = scale.length
  return inputs.map((_, rowIndex) => {
    const normalized = cache.normalized[rowIndex]
    const delta = outputGradient[rowIndex].map((value, dimension) => value * scale[dimension])
    delta.forEach((_, dimension) => {
      scaleGradient[dimension] += outputGradient[rowIndex][dimension] * normalized[dimension]
      biasGradient[dimension] += outputGradient[rowIndex][dimension]
    })
    const sum = delta.reduce((total, value) => total + value, 0)
    const projected = dot(delta, normalized)
    return delta.map((value, dimension) =>
      cache.inverseStd[rowIndex] * (dimensions * value - sum - normalized[dimension] * projected) / dimensions,
    )
  })
}

function zeroGradients(model: TransformerModel): Gradients {
  return {
    inputWeights: zeroMatrixLike(model.inputWeights),
    inputBias: zerosLike(model.inputBias),
    queryWeights: zeroMatrixLike(model.queryWeights),
    queryBias: zerosLike(model.queryBias),
    keyWeights: zeroMatrixLike(model.keyWeights),
    keyBias: zerosLike(model.keyBias),
    valueWeights: zeroMatrixLike(model.valueWeights),
    valueBias: zerosLike(model.valueBias),
    attentionOutputWeights: zeroMatrixLike(model.attentionOutputWeights),
    attentionOutputBias: zerosLike(model.attentionOutputBias),
    norm1Scale: zerosLike(model.norm1Scale),
    norm1Bias: zerosLike(model.norm1Bias),
    feedForwardWeights: zeroMatrixLike(model.feedForwardWeights),
    feedForwardBias: zerosLike(model.feedForwardBias),
    projectionWeights: zeroMatrixLike(model.projectionWeights),
    projectionBias: zerosLike(model.projectionBias),
    norm2Scale: zerosLike(model.norm2Scale),
    norm2Bias: zerosLike(model.norm2Bias),
    outputWeights: zeroMatrixLike(model.outputWeights),
    outputBias: zerosLike(model.outputBias),
  }
}

function applyGradients(model: TransformerModel, gradients: Gradients, rate: number): void {
  for (const key of Object.keys(gradients) as Array<keyof Gradients>) {
    const parameter = model[key]
    const gradient = gradients[key]
    if (Array.isArray(parameter[0])) {
      const parameterMatrix = parameter as number[][]
      const gradientMatrix = gradient as number[][]
      parameterMatrix.forEach((row, index) => row.forEach((value, column) => { row[column] = value - rate * gradientMatrix[index][column] }))
    } else {
      const parameterVector = parameter as number[]
      const gradientVector = gradient as number[]
      parameterVector.forEach((value, index) => { parameterVector[index] = value - rate * gradientVector[index] })
    }
  }
}

function validate(config: TransformerTrainConfig): void {
  if (!config.samples.length || config.samples.length !== config.labels.length) {
    throw new Error('samples and labels must be non-empty and have equal length')
  }
  if (config.labels.some(label => (typeof label !== 'string' && typeof label !== 'number') || (typeof label === 'number' && !Number.isFinite(label)))) {
    throw new Error('标签必须是字符串或有限数值')
  }
  if (new Set(config.labels).size < 2) throw new Error('at least two classes are required')
  const { steps, channels } = config.sequenceShape ?? {} as TransformerSequenceShape
  if (!Number.isSafeInteger(steps) || steps < 1 || steps > 512 || !Number.isSafeInteger(channels) || channels < 1 || channels > 64) {
    throw new Error('sequence steps and channels must be valid positive integers')
  }
  const dimensions = steps * channels
  if (!Number.isSafeInteger(dimensions) || config.samples.some(sample => sample.length !== dimensions)) {
    throw new Error('sample dimensions must match steps times channels')
  }
  if (config.samples.some(sample => sample.some(value => !Number.isFinite(value)))) {
    throw new Error('samples must contain finite features')
  }
  if (config.modelDimension !== undefined && (!Number.isSafeInteger(config.modelDimension) || config.modelDimension < 2 || config.modelDimension > 64)) {
    throw new Error('modelDimension must be an integer between 2 and 64')
  }
  if (config.attentionHeads !== undefined && (!Number.isSafeInteger(config.attentionHeads) || config.attentionHeads < 1 || config.attentionHeads > 8)) {
    throw new Error('attentionHeads must be an integer between 1 and 8')
  }
  const modelDimension = config.modelDimension ?? defaults.modelDimension
  const attentionHeads = config.attentionHeads ?? defaults.attentionHeads
  if (modelDimension % attentionHeads !== 0) throw new Error('modelDimension must be divisible by attentionHeads')
  if (config.feedForwardSize !== undefined && (!Number.isSafeInteger(config.feedForwardSize) || config.feedForwardSize < 1 || config.feedForwardSize > 256)) {
    throw new Error('feedForwardSize must be an integer between 1 and 256')
  }
  if (config.learningRate !== undefined && (!(config.learningRate > 0) || !Number.isFinite(config.learningRate))) {
    throw new Error('learningRate must be positive and finite')
  }
  if (config.epochs !== undefined && (!Number.isSafeInteger(config.epochs) || config.epochs < 1 || config.epochs > 2000)) {
    throw new Error('epochs must be an integer between 1 and 2000')
  }
  if (config.batchSize !== undefined && (!Number.isSafeInteger(config.batchSize) || config.batchSize < 1 || config.batchSize > 4096)) {
    throw new Error('batchSize must be an integer between 1 and 4096')
  }
  if (config.seed !== undefined && !Number.isSafeInteger(config.seed)) throw new Error('seed must be a safe integer')
}

function linear(input: readonly number[], weights: number[][], bias: number[]): number[] {
  return weights.map((row, output) => dot(row, input) + bias[output])
}

function linearRows(inputs: number[][], weights: number[][], bias: number[]): number[][] {
  return inputs.map(input => linear(input, weights, bias))
}

function linearBackward(
  inputs: number[][],
  weights: number[][],
  outputGradient: number[][],
  weightGradient: number[][],
  biasGradient: number[],
): number[][] {
  const inputGradient = inputs.map(() => zeros(weights[0].length))
  inputs.forEach((input, row) => outputGradient[row].forEach((delta, output) => {
    biasGradient[output] += delta
    for (let dimension = 0; dimension < input.length; dimension += 1) {
      weightGradient[output][dimension] += delta * input[dimension]
      inputGradient[row][dimension] += weights[output][dimension] * delta
    }
  }))
  return inputGradient
}

function positionalEncoding(step: number, dimension: number, modelDimension: number): number {
  const exponent = Math.floor(dimension / 2) * 2 / modelDimension
  const angle = step / Math.pow(10000, exponent)
  return dimension % 2 === 0 ? Math.sin(angle) : Math.cos(angle)
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

function zeros(length: number): number[] { return Array(length).fill(0) }
function zerosLike(values: number[]): number[] { return values.map(() => 0) }
function zeroMatrixLike(values: number[][]): number[][] { return values.map(row => zeros(row.length)) }
function randomMatrix(rows: number, columns: number, random: () => number, limit: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => (random() * 2 - 1) * limit))
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
function argMax(values: readonly number[]): number {
  return values.reduce((best, value, index) => value > values[best] ? index : best, 0)
}
function hasFiniteParameters(model: TransformerModel): boolean {
  return (Object.values(model) as unknown[]).every(value =>
    !Array.isArray(value) || (Array.isArray(value[0])
      ? (value as number[][]).every(row => row.every(Number.isFinite))
      : (value as unknown[]).every(item => !Array.isArray(item) && (typeof item !== 'number' || Number.isFinite(item)))),
  )
}

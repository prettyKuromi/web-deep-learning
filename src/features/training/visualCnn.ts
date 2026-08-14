import type { Trainer, TrainSnapshot, VisualCnnModel, VisualCnnTrainConfig } from './types'
import { describeVisualNetwork, type VisualLayer } from './visualNetwork'

type Tensor = { data: number[]; c: number; h: number; w: number }
type Parameters = Record<string, { weights: number[]; biases: number[]; inputSize: number; outputSize: number }>
type Cache = { input: Tensor; output: Tensor; pool?: number[]; mask?: number[] }

export function createVisualCnnTrainer(): Trainer<VisualCnnTrainConfig, VisualCnnModel> {
  return {
    async train(config, emit) {
      validate(config)
      const labels = [...new Set(config.labels)]
      const seed = config.seed ?? 1
      const random = rng(seed)
      const parameters = initialize(config.layers, config.imageShape, labels.length, random)
      const epochs = config.epochs ?? 40; const batchSize = config.batchSize ?? 20; const rate = config.learningRate ?? .03
      const snapshots: TrainSnapshot[] = []; const description = describeVisualNetwork(config.layers, config.imageShape, labels.length)
      for (let epoch = 0; epoch < epochs; epoch += 1) {
        const order = config.samples.map((_, index) => index); shuffle(order, random)
        for (let start = 0; start < order.length; start += batchSize) {
          const gradients = zeroGradients(parameters); const batch = order.slice(start, start + batchSize)
          for (const index of batch) backward(config.samples[index], labels.indexOf(config.labels[index]), config.layers, config.imageShape, parameters, gradients, random)
          Object.keys(parameters).forEach((key) => { parameters[key].weights.forEach((_, i) => { parameters[key].weights[i] -= rate * gradients[key].weights[i] / batch.length }); parameters[key].biases.forEach((_, i) => { parameters[key].biases[i] -= rate * gradients[key].biases[i] / batch.length }) })
        }
        const loss = config.samples.reduce((total, sample, index) => total - Math.log(Math.max(forward(sample, config.layers, config.imageShape, parameters, false, random).probabilities[labels.indexOf(config.labels[index])], 1e-12)), 0) / config.samples.length
        if (epoch === 0 || epoch === epochs - 1 || (epoch + 1) % Math.max(1, Math.floor(epochs / 10)) === 0) { const snapshot = { iteration: epoch + 1, epoch: epoch + 1, loss, network: description.layers.map((layer) => ({ name: layer.name, shape: layer.shape, parameters: layer.parameters, activation: .5 })) }; snapshots.push(snapshot); emit?.(snapshot) }
      }
      return { model: { kind: 'visual-cnn', labels, imageShape: config.imageShape, layers: config.layers, parameters, seed }, snapshots }
    },
    predict(model, samples) { return samples.map((sample) => { const scores = forward(sample, model.layers, model.imageShape, model.parameters, false, rng(model.seed)).probabilities; return model.labels[scores.reduce((best, value, index) => value > scores[best] ? index : best, 0)] }) },
  }
}

function initialize(layers: readonly VisualLayer[], shape: VisualCnnTrainConfig['imageShape'], classes: number, random: () => number): Parameters {
  const parameters: Parameters = {}; let c = shape.channels; let h = shape.height; let w = shape.width; let vector = 0
  for (const layer of layers) { if (layer.type === 'conv2d') { parameters[layer.id] = make(layer.filters * c * 9, layer.filters, c * 9, layer.filters, random); c = layer.filters } else if (layer.type === 'max-pool') { h = Math.floor(h / 2); w = Math.floor(w / 2) } else if (layer.type === 'dense') { const input = vector || c * h * w; parameters[layer.id] = make(layer.units * input, layer.units, input, layer.units, random); vector = layer.units } }
  const input = vector || c * h * w; parameters.output = make(classes * input, classes, input, classes, random); return parameters
}
function make(weightCount: number, biasCount: number, inputSize: number, outputSize: number, random: () => number) { return { weights: Array.from({ length: weightCount }, () => (random() * 2 - 1) * Math.sqrt(2 / inputSize)), biases: Array(biasCount).fill(0), inputSize, outputSize } }
function forward(sample: readonly number[], layers: readonly VisualLayer[], shape: VisualCnnTrainConfig['imageShape'], parameters: Parameters, training: boolean, random: () => number) {
  let current: Tensor = { data: [...sample], c: shape.channels, h: shape.height, w: shape.width }; const caches: Cache[] = []
  for (const layer of layers) { const input = current; let pool: number[] | undefined; let mask: number[] | undefined
    if (layer.type === 'conv2d') current = conv(input, parameters[layer.id])
    else if (layer.type === 'max-pool') { const result = maxPool(input); current = result.output; pool = result.indices }
    else if (layer.type === 'dense') current = dense(input, parameters[layer.id])
    else if (layer.type === 'activation') current = { ...input, data: input.data.map((value) => active(value, layer.activation)) }
    else { mask = training ? input.data.map(() => random() >= layer.rate ? 1 / (1 - layer.rate) : 0) : input.data.map(() => 1); current = { ...input, data: input.data.map((value, index) => value * mask![index]) } }
    caches.push({ input, output: current, pool, mask })
  }
  const output = dense(current, parameters.output); return { probabilities: softmax(output.data), caches, final: current }
}
function backward(sample: readonly number[], target: number, layers: readonly VisualLayer[], shape: VisualCnnTrainConfig['imageShape'], parameters: Parameters, gradients: Parameters, random: () => number) {
  const run = forward(sample, layers, shape, parameters, true, random); let delta = run.probabilities.map((value, index) => value - (index === target ? 1 : 0)); denseGrad(run.final, delta, parameters.output, gradients.output); delta = denseBack(run.final, delta, parameters.output)
  for (let index = layers.length - 1; index >= 0; index -= 1) { const layer = layers[index]; const cache = run.caches[index]
    if (layer.type === 'dense') { denseGrad(cache.input, delta, parameters[layer.id], gradients[layer.id]); delta = denseBack(cache.input, delta, parameters[layer.id]) }
    else if (layer.type === 'conv2d') { convGrad(cache.input, delta, parameters[layer.id], gradients[layer.id]); delta = convBack(cache.input, delta, parameters[layer.id]) }
    else if (layer.type === 'max-pool') { const next = Array(cache.input.data.length).fill(0); cache.pool!.forEach((source, output) => { next[source] += delta[output] }); delta = next }
    else if (layer.type === 'activation') delta = delta.map((value, item) => value * derivative(cache.input.data[item], layer.activation))
    else delta = delta.map((value, item) => value * cache.mask![item])
  }
}
function conv(input: Tensor, param: Parameters[string]): Tensor { const c = param.inputSize / 9; const out: number[] = []; for (let f = 0; f < param.outputSize; f += 1) for (let y = 0; y < input.h; y += 1) for (let x = 0; x < input.w; x += 1) { let value = param.biases[f]; for (let channel = 0; channel < c; channel += 1) for (let ky = -1; ky <= 1; ky += 1) for (let kx = -1; kx <= 1; kx += 1) { const py = y + ky; const px = x + kx; if (py >= 0 && py < input.h && px >= 0 && px < input.w) value += input.data[(channel * input.h + py) * input.w + px] * param.weights[(f * c + channel) * 9 + (ky + 1) * 3 + kx + 1] } out.push(value) } return { data: out, c: param.outputSize, h: input.h, w: input.w } }
function convGrad(input: Tensor, delta: number[], param: Parameters[string], gradient: Parameters[string]) { const c = param.inputSize / 9; for (let f = 0; f < param.outputSize; f += 1) for (let y = 0; y < input.h; y += 1) for (let x = 0; x < input.w; x += 1) { const d = delta[(f * input.h + y) * input.w + x]; gradient.biases[f] += d; for (let channel = 0; channel < c; channel += 1) for (let ky = -1; ky <= 1; ky += 1) for (let kx = -1; kx <= 1; kx += 1) { const py = y + ky; const px = x + kx; if (py >= 0 && py < input.h && px >= 0 && px < input.w) gradient.weights[(f * c + channel) * 9 + (ky + 1) * 3 + kx + 1] += d * input.data[(channel * input.h + py) * input.w + px] } } }
function convBack(input: Tensor, delta: number[], param: Parameters[string]) { const result = Array(input.data.length).fill(0); const c = param.inputSize / 9; for (let f = 0; f < param.outputSize; f += 1) for (let y = 0; y < input.h; y += 1) for (let x = 0; x < input.w; x += 1) for (let channel = 0; channel < c; channel += 1) for (let ky = -1; ky <= 1; ky += 1) for (let kx = -1; kx <= 1; kx += 1) { const py = y + ky; const px = x + kx; if (py >= 0 && py < input.h && px >= 0 && px < input.w) result[(channel * input.h + py) * input.w + px] += delta[(f * input.h + y) * input.w + x] * param.weights[(f * c + channel) * 9 + (ky + 1) * 3 + kx + 1] } return result }
function dense(input: Tensor, param: Parameters[string]): Tensor { return { data: Array.from({ length: param.outputSize }, (_, row) => param.biases[row] + input.data.reduce((sum, value, col) => sum + value * param.weights[row * param.inputSize + col], 0)), c: 1, h: 1, w: param.outputSize } }
function denseGrad(input: Tensor, delta: number[], _param: Parameters[string], gradient: Parameters[string]) { delta.forEach((value, row) => { gradient.biases[row] += value; input.data.forEach((feature, col) => { gradient.weights[row * input.data.length + col] += value * feature }) }) }
function denseBack(input: Tensor, delta: number[], param: Parameters[string]) { return input.data.map((_, col) => delta.reduce((sum, value, row) => sum + value * param.weights[row * param.inputSize + col], 0)) }
function maxPool(input: Tensor) { const h = Math.floor(input.h / 2); const w = Math.floor(input.w / 2); const data: number[] = []; const indices: number[] = []; for (let c = 0; c < input.c; c += 1) for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const options = [0, 1, 2, 3].map((offset) => (c * input.h + y * 2 + Math.floor(offset / 2)) * input.w + x * 2 + offset % 2); const best = options.reduce((winner, option) => input.data[option] > input.data[winner] ? option : winner, options[0]); data.push(input.data[best]); indices.push(best) } return { output: { data, c: input.c, h, w }, indices } }
function zeroGradients(parameters: Parameters): Parameters { return Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, { ...value, weights: Array(value.weights.length).fill(0), biases: Array(value.biases.length).fill(0) }])) }
function active(value: number, name: 'relu' | 'tanh' | 'sigmoid') { return name === 'relu' ? Math.max(0, value) : name === 'tanh' ? Math.tanh(value) : 1 / (1 + Math.exp(-value)) }
function derivative(value: number, name: 'relu' | 'tanh' | 'sigmoid') { const output = active(value, name); return name === 'relu' ? Number(value > 0) : name === 'tanh' ? 1 - output ** 2 : output * (1 - output) }
function softmax(values: number[]) { const max = Math.max(...values); const exp = values.map((value) => Math.exp(value - max)); const sum = exp.reduce((a, b) => a + b, 0); return exp.map((value) => value / sum) }
function rng(seed: number) { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 } }
function shuffle(values: number[], random: () => number) { for (let i = values.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]] } }
function validate(config: VisualCnnTrainConfig) { const description = describeVisualNetwork(config.layers, config.imageShape, new Set(config.labels).size); if (!description.valid) throw new Error(description.errors.join('；')); const size = config.imageShape.width * config.imageShape.height * config.imageShape.channels; if (!config.samples.length || config.samples.length !== config.labels.length || config.samples.some((sample) => sample.length !== size || sample.some((value) => !Number.isFinite(value)))) throw new Error('图像特征、标签或尺寸无效') }

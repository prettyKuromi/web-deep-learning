import type { DecisionTreeModel, DecisionTreeNode, DecisionTreeTrainConfig, FeatureMatrix, Label, Labels, Trainer, TrainSnapshot } from './types'

export function createDecisionTreeTrainer(): Trainer<DecisionTreeTrainConfig, DecisionTreeModel> {
  return {
    async train(config, emit) {
      validate(config)
      const dimensions = config.samples[0].length
      const indices = config.samples.map((_, i) => i)
      const random = config.maxFeatures === undefined ? undefined : createRandom(config.seed ?? 42)
      const root = build(config.samples, config.labels, indices, 0, config.maxDepth ?? 5, config.minSamplesSplit ?? 2, config.maxFeatures, random)
      const predictions = config.samples.map(sample => predictNode(root, sample))
      const loss = predictions.reduce<number>((sum, prediction, i) => sum + (prediction === config.labels[i] ? 0 : 1), 0) / config.labels.length
      const snapshot: TrainSnapshot = { iteration: 1, loss }
      emit?.(snapshot)
      return { model: { kind: 'decision-tree', root, dimensions }, snapshots: [snapshot] }
    },
    predict(model, samples) {
      return samples.map(sample => {
        if (sample.length !== model.dimensions) throw new Error('sample dimensions do not match model')
        let node = model.root
        while (node.feature !== undefined && node.threshold !== undefined) node = sample[node.feature] <= node.threshold ? node.left! : node.right!
        return node.prediction
      })
    },
  }
}

function predictNode(root: DecisionTreeNode, sample: readonly number[]): Label {
  let node = root
  while (node.feature !== undefined && node.threshold !== undefined) node = sample[node.feature] <= node.threshold ? node.left! : node.right!
  return node.prediction
}

function build(samples: FeatureMatrix, labels: Labels, indices: number[], depth: number, maxDepth: number, minSplit: number, maxFeatures?: number, random?: () => number): DecisionTreeNode {
  const prediction = majority(indices.map(i => labels[i]))
  if (depth >= maxDepth || indices.length < minSplit || new Set(indices.map(i => labels[i])).size < 2) return { prediction }
  let best: { feature: number; threshold: number; score: number; left: number[]; right: number[] } | undefined
  const features = maxFeatures === undefined ? samples[0].map((_, feature) => feature) : chooseFeatures(samples[0].length, maxFeatures, random!)
  for (const feature of features) {
    const values = [...new Set(indices.map(i => samples[i][feature]))].sort((a, b) => a - b)
    for (let i = 0; i < values.length - 1; i++) {
      const threshold = midpoint(values[i], values[i + 1])
      const left = indices.filter(index => samples[index][feature] <= threshold)
      const right = indices.filter(index => samples[index][feature] > threshold)
      if (!left.length || !right.length) continue
      const score = gini(labels, left) * left.length + gini(labels, right) * right.length
      if (!best || score < best.score) best = { feature, threshold, score, left, right }
    }
  }
  if (!best) return { prediction }
  return { prediction, feature: best.feature, threshold: best.threshold, left: build(samples, labels, best.left, depth + 1, maxDepth, minSplit, maxFeatures, random), right: build(samples, labels, best.right, depth + 1, maxDepth, minSplit, maxFeatures, random) }
}
function midpoint(lower: number, upper: number): number {
  if ((lower < 0) === (upper < 0)) return lower + (upper - lower) / 2
  return lower / 2 + upper / 2
}
function chooseFeatures(dimensions: number, count: number, random: () => number): number[] {
  const features = Array.from({ length: dimensions }, (_, feature) => feature)
  for (let i = 0; i < count; i++) {
    const selected = i + Math.floor(random() * (dimensions - i))
    const feature = features[i]
    features[i] = features[selected]
    features[selected] = feature
  }
  return features.slice(0, count).sort((a, b) => a - b)
}
function createRandom(seed: number): () => number { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 } }
function gini(labels: Labels, indices: number[]): number { const counts = new Map<Label, number>(); indices.forEach(i => counts.set(labels[i], (counts.get(labels[i]) ?? 0) + 1)); return 1 - [...counts.values()].reduce((sum, count) => sum + (count / indices.length) ** 2, 0) }
function majority(values: Labels): Label { const counts = new Map<Label, number>(); values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] }
function validate(config: DecisionTreeTrainConfig): void { if (!config.samples.length || config.samples.length !== config.labels.length) throw new Error('samples and labels must be non-empty and have equal length'); const dimensions = config.samples[0].length; if (!dimensions || config.samples.some(row => row.length !== dimensions || row.some(value => !Number.isFinite(value)))) throw new Error('samples must have consistent finite dimensions'); if (config.maxFeatures !== undefined && (!Number.isInteger(config.maxFeatures) || config.maxFeatures < 1 || config.maxFeatures > dimensions)) throw new Error('maxFeatures must be a valid feature count'); if (config.seed !== undefined && (!Number.isSafeInteger(config.seed) || config.seed < 0)) throw new Error('seed must be a non-negative integer') }

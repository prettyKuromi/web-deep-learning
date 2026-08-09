import type { AdaBoostModel, AdaBoostTrainConfig, FeatureMatrix, Label, Labels, PerceptronModel, PerceptronTrainConfig, RandomForestModel, RandomForestTrainConfig, Trainer } from './types'
import { createDecisionTreeTrainer } from './decisionTree'

export function createPerceptronTrainer(): Trainer<PerceptronTrainConfig, PerceptronModel> {
  return {
    async train({ samples, labels, learningRate = 0.1, iterations = 100 }) {
      validateClassification(samples, labels)
      const classes = [...new Set(labels)]
      const dimensions = samples[0].length
      const weights = classes.map(() => Array(dimensions + 1).fill(0))
      for (let epoch = 0; epoch < iterations; epoch++) for (let i = 0; i < samples.length; i++) {
        const row = [1, ...samples[i]]; const actual = classes.indexOf(labels[i]); const predicted = argmax(weights.map(weight => dot(weight, row)))
        if (actual !== predicted) row.forEach((value, j) => { weights[actual][j] += learningRate * value; weights[predicted][j] -= learningRate * value })
      }
      return { model: { kind: 'perceptron', labels: classes, weights, dimensions }, snapshots: [] }
    },
    predict(model, samples) { return samples.map(sample => model.labels[argmax(model.weights.map(weight => dot(weight, [1, ...sample])))]) },
  }
}

export function createRandomForestTrainer(): Trainer<RandomForestTrainConfig, RandomForestModel> {
  return {
    async train({ samples, labels, trees = 9, maxDepth = 5 }) {
      validateClassification(samples, labels)
      const dimensions = samples[0].length
      const treeTrainer = createDecisionTreeTrainer()
      const forest = await Promise.all(Array.from({ length: trees }, () => treeTrainer.train({ samples, labels, maxDepth }).then(result => result.model)))
      return { model: { kind: 'random-forest', trees: forest, labels: [...new Set(labels)], dimensions }, snapshots: [] }
    },
    predict(model, samples) { return samples.map(sample => vote(model.trees.map(tree => { let node = tree.root; while (node.feature !== undefined && node.threshold !== undefined) node = sample[node.feature] <= node.threshold ? node.left! : node.right!; return node.prediction }))) },
  }
}

export function createAdaBoostTrainer(): Trainer<AdaBoostTrainConfig, AdaBoostModel> {
  return {
    async train({ samples, labels, rounds = 20 }) {
      validateClassification(samples, labels)
      const classes = [...new Set(labels)]; if (classes.length !== 2) throw new Error('AdaBoost 当前仅支持二分类')
      const y = labels.map(label => label === classes[0] ? 1 : -1); const weights = Array(samples.length).fill(1 / samples.length); const stumps: AdaBoostModel['stumps'] = []
      for (let round = 0; round < rounds; round++) {
        let best = { feature: 0, threshold: samples[0][0], polarity: 1, error: Infinity }
        for (let feature = 0; feature < samples[0].length; feature++) for (const threshold of samples.map(row => row[feature])) for (const polarity of [1, -1]) {
          const error = samples.reduce((sum, row, i) => sum + (polarity * (row[feature] <= threshold ? 1 : -1) === y[i] ? 0 : weights[i]), 0)
          if (error < best.error) best = { feature, threshold, polarity, error }
        }
        if (best.error >= 0.5) break
        const alpha = .5 * Math.log((1 - best.error) / Math.max(best.error, 1e-12)); stumps.push({ ...best, alpha })
        const normalizer = weights.reduce((sum, weight, i) => sum + weight * Math.exp(-alpha * y[i] * best.polarity * (samples[i][best.feature] <= best.threshold ? 1 : -1)), 0)
        weights.forEach((weight, i) => { weights[i] = weight * Math.exp(-alpha * y[i] * best.polarity * (samples[i][best.feature] <= best.threshold ? 1 : -1)) / normalizer })
      }
      return { model: { kind: 'adaboost', stumps, labels: classes, dimensions: samples[0].length }, snapshots: [] }
    },
    predict(model, samples) { return samples.map(sample => model.stumps.reduce((sum, stump) => sum + stump.alpha * stump.polarity * (sample[stump.feature] <= stump.threshold ? 1 : -1), 0) >= 0 ? model.labels[0] : model.labels[1]) },
  }
}

function vote(values: readonly Label[]): Label { const counts = new Map<Label, number>(); values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] }
function argmax(values: readonly number[]) { return values.reduce((best, value, i) => value > values[best] ? i : best, 0) }
function dot(a: readonly number[], b: readonly number[]) { return a.reduce((sum, value, i) => sum + value * b[i], 0) }
function validateClassification(samples: FeatureMatrix, labels: Labels) { if (!samples.length || samples.length !== labels.length || new Set(labels).size < 2) throw new Error('需要至少两类且特征与标签数量一致'); if (samples.some(row => row.length !== samples[0].length || row.some(value => !Number.isFinite(value)))) throw new Error('特征必须为维度一致的有限数值') }

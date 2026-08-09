import { describe, expect, it } from 'vitest'
import { createKnnTrainer } from '../knn'
import { createLogisticRegressionTrainer } from '../logisticRegression'
import { createLinearSvmTrainer } from '../linearSvm'
import { createLinearRegressionTrainer, createRidgeRegressionTrainer } from '../regression'
import { createKMeansTrainer } from '../kmeans'
import { createPcaTrainer } from '../pca'
import { createDecisionTreeTrainer } from '../decisionTree'
import { createNaiveBayesTrainer } from '../naiveBayes'
import { createPerceptronTrainer, createRandomForestTrainer, createAdaBoostTrainer } from '../ensembles'
import { createDbscanTrainer } from '../dbscan'
import { classificationMetrics } from '../metrics'
import type { FeatureMatrix, Labels, Trainer } from '../types'

const samples: FeatureMatrix = [
  [0, 0],
  [0, 1],
  [5, 5],
  [5, 4],
]
const labels: Labels = ['left', 'left', 'right', 'right']

describe('Trainer contract', () => {
  it('exposes train and predict methods', () => {
    const trainer: Trainer = createKnnTrainer()
    expect(typeof trainer.train).toBe('function')
    expect(typeof trainer.predict).toBe('function')
  })
})

describe('KNN trainer', () => {
  it('fits samples and predicts nearest labels', async () => {
    const trainer = createKnnTrainer()
    const result = await trainer.train({ samples, labels, k: 1 })
    expect(result.model).toBeDefined()
    expect(trainer.predict(result.model, [[0.2, 0.1], [4.8, 4.9]])).toEqual(['left', 'right'])
  })

  it('emits a snapshot and rejects invalid k', async () => {
    const trainer = createKnnTrainer()
    const snapshots: unknown[] = []
    await trainer.train({ samples, labels, k: 3 }, snapshot => snapshots.push(snapshot))
    expect(snapshots).toHaveLength(1)
    await expect(trainer.train({ samples, labels, k: 0 })).rejects.toThrow(/k/i)
  })
})

describe('classification metrics', () => {
  it('computes accuracy, macro precision, recall, f1 and confusion matrix', () => {
    const metrics = classificationMetrics(['a', 'a', 'b', 'b'], ['a', 'b', 'b', 'b'])
    expect(metrics.accuracy).toBe(0.75)
    expect(metrics.precision).toBeCloseTo((1 + 2 / 3) / 2)
    expect(metrics.recall).toBeCloseTo((0.5 + 1) / 2)
    expect(metrics.f1).toBeCloseTo((2 / 3 + 0.8) / 2)
    expect(metrics.labels).toEqual(['a', 'b'])
    expect(metrics.confusionMatrix).toEqual([
      [1, 1],
      [0, 2],
    ])
  })
})

describe('logistic regression trainer', () => {
  it('trains a multiclass model and emits loss snapshots', async () => {
    const trainer = createLogisticRegressionTrainer()
    const snapshots: any[] = []
    const result = await trainer.train({ samples, labels, learningRate: 0.5, iterations: 120 }, s => snapshots.push(s))
    expect(result.model.kind).toBe('logistic-regression')
    expect(snapshots.length).toBeGreaterThan(1)
    expect(snapshots.at(-1).loss).toBeLessThan(snapshots[0].loss)
    expect(trainer.predict(result.model, samples)).toEqual(labels)
  })
})

describe('linear SVM trainer', () => {
  it('trains a multiclass one-vs-rest model and emits snapshots', async () => {
    const trainer = createLinearSvmTrainer()
    const snapshots: any[] = []
    const result = await trainer.train({ samples, labels, learningRate: 0.05, iterations: 200, regularization: 0.001 }, s => snapshots.push(s))
    expect(result.model.kind).toBe('linear-svm')
    expect(snapshots.length).toBeGreaterThan(1)
    expect(trainer.predict(result.model, samples)).toEqual(labels)
  })
})

describe('regression trainers', () => {
  const regressionSamples: FeatureMatrix = [[0, 0], [1, 1], [2, 2], [3, 3]]
  const regressionLabels = [1, 3, 5, 7]

  it('fits linear regression and predicts continuous values', async () => {
    const trainer = createLinearRegressionTrainer()
    const result = await trainer.train({ samples: regressionSamples, labels: regressionLabels, learningRate: 0.05, iterations: 500 })
    expect(result.model.kind).toBe('linear-regression')
    expect(trainer.predict(result.model, [[4, 4]])[0]).toBeCloseTo(9, 0)
  })

  it('fits ridge regression with regularization', async () => {
    const trainer = createRidgeRegressionTrainer()
    const result = await trainer.train({ samples: regressionSamples, labels: regressionLabels, learningRate: 0.05, iterations: 500, regularization: 0.01 })
    expect(result.model.kind).toBe('ridge-regression')
    expect(trainer.predict(result.model, [[4, 4]])[0]).toBeCloseTo(9, 0)
  })
})

describe('K-Means trainer', () => {
  it('finds two clusters and predicts assignments', async () => {
    const trainer = createKMeansTrainer()
    const result = await trainer.train({ samples: [[0, 0], [0, 1], [10, 10], [10, 11]], k: 2, iterations: 20, seed: 1 })
    expect(result.model.kind).toBe('k-means')
    expect(new Set(trainer.predict(result.model, [[0, 0], [10, 10]])).size).toBe(2)
  })
})

describe('PCA trainer', () => {
  it('projects samples and reports explained variance', async () => {
    const trainer = createPcaTrainer()
    const result = await trainer.train({ samples: [[1, 1], [2, 2], [3, 3]], components: 1 })
    expect(result.model.kind).toBe('pca')
    expect(result.model.explainedVariance[0]).toBeCloseTo(1, 5)
    expect(result.snapshots.length).toBeGreaterThan(1)
    expect(result.snapshots.every(snapshot => Number.isFinite(snapshot.loss))).toBe(true)
    expect(trainer.predict(result.model, [[4, 4]])[0]).toHaveLength(1)
  })
})

describe('additional course algorithms', () => {
  it('trains perceptron, random forest and AdaBoost on separable samples', async () => {
    const configs = [
      [createPerceptronTrainer(), { samples, labels, iterations: 30, learningRate: 0.1 }],
      [createRandomForestTrainer(), { samples, labels, trees: 5, maxDepth: 3 }],
      [createAdaBoostTrainer(), { samples, labels, rounds: 10 }],
    ] as const
    for (const [trainer, config] of configs) {
      const result = await trainer.train(config as never)
      expect(trainer.predict(result.model as never, samples)).toEqual(labels)
    }
  })

  it('finds dense groups and labels isolated points as noise with DBSCAN', async () => {
    const trainer = createDbscanTrainer()
    const result = await trainer.train({ samples: [[0, 0], [0.1, 0], [5, 5], [5.1, 5], [20, 20]], epsilon: 0.3, minPoints: 2 })
    expect(trainer.predict(result.model, [[0, 0], [5, 5], [20, 20]])).toEqual([0, 1, -1])
  })
})

describe('decision tree trainer', () => {
  it('fits a simple threshold and predicts labels', async () => {
    const trainer = createDecisionTreeTrainer()
    const result = await trainer.train({ samples: [[0], [1], [4], [5]], labels: ['low', 'low', 'high', 'high'], maxDepth: 2 })
    expect(result.model.kind).toBe('decision-tree')
    expect(trainer.predict(result.model, [[0.5], [4.5]])).toEqual(['low', 'high'])
  })
})

describe('naive bayes trainer', () => {
  it('fits gaussian class distributions and predicts labels', async () => {
    const trainer = createNaiveBayesTrainer()
    const result = await trainer.train({ samples: [[0, 0], [0, 1], [5, 5], [5, 4]], labels: ['left', 'left', 'right', 'right'] })
    expect(result.model.kind).toBe('naive-bayes')
    expect(trainer.predict(result.model, [[0.2, 0.1], [4.8, 4.9]])).toEqual(['left', 'right'])
  })
})

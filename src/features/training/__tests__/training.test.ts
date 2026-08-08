import { describe, expect, it } from 'vitest'
import { createKnnTrainer } from '../knn'
import { createLogisticRegressionTrainer } from '../logisticRegression'
import { createLinearSvmTrainer } from '../linearSvm'
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

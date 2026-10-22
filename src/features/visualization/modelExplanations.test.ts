import { describe, expect, it } from 'vitest'
import { createModelExplanation } from './modelExplanations'

describe('createModelExplanation', () => {
  it('为 MLP 提供层结构、激活函数和权重连接数据', () => {
    const explanation = createModelExplanation('mlp', {
      kind: 'mlp', labels: ['否', '是'], layers: [2, 4, 2], activation: 'tanh',
      weights: [[[0.1, -0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]], [[0.9, 1], [1.1, 1.2]]], biases: [[], []], seed: 42,
    })

    expect(explanation.level).toBe('detailed')
    expect(explanation.visualization).toMatchObject({ type: 'neural-network', layers: [2, 4, 2], activation: 'tanh' })
    expect(explanation.items).toContainEqual({ label: '网络结构', value: '2 → 4 → 2' })
  })

  it('为逻辑回归提供权重和概率面的教学说明', () => {
    const explanation = createModelExplanation('logistic-regression', {
      kind: 'logistic-regression', labels: ['A', 'B'], weights: [[0.2, 1, -1], [-0.2, -1, 1]], dimensions: 2,
    })

    expect(explanation.visualization).toMatchObject({ type: 'linear-boundary', algorithm: 'logistic-regression', weights: [[0.2, 1, -1], [-0.2, -1, 1]] })
    expect(explanation.description).toContain('概率')
  })

  it('为线性 SVM 提供间隔与权重数据', () => {
    const explanation = createModelExplanation('linear-svm', {
      kind: 'linear-svm', labels: [0, 1], weights: [[0.5, 1, -1], [-0.5, -1, 1]], dimensions: 2,
    })

    expect(explanation.visualization).toMatchObject({ type: 'linear-boundary', algorithm: 'linear-svm', margin: 1 })
    expect(explanation.items).toContainEqual({ label: '优化目标', value: '最小化 hinge loss，并最大化分类间隔' })
  })

  it('为决策树保留可渲染的树结构和根分裂规则', () => {
    const explanation = createModelExplanation('decision-tree', {
      kind: 'decision-tree', dimensions: 2,
      root: { prediction: 'A', feature: 1, threshold: 0.6, left: { prediction: 'A' }, right: { prediction: 'B' } },
    })

    expect(explanation.visualization).toMatchObject({ type: 'tree', tree: { rule: '特征 2 ≤ 0.600' } })
    expect(explanation.items).toContainEqual({ label: '根节点规则', value: '特征 2 ≤ 0.600' })
  })

  it('为随机森林和 AdaBoost 提供集成规模与弱学习器数据', () => {
    const forest = createModelExplanation('random-forest', {
      kind: 'random-forest', labels: ['A', 'B'], dimensions: 2,
      trees: [{ kind: 'decision-tree', dimensions: 2, root: { prediction: 'A' } }, { kind: 'decision-tree', dimensions: 2, root: { prediction: 'B' } }],
    })
    const boosting = createModelExplanation('adaboost', {
      kind: 'adaboost', labels: ['A', 'B'], dimensions: 2,
      stumps: [{ feature: 0, threshold: 0.3, polarity: 1, alpha: 0.8 }],
    })

    expect(forest.visualization).toMatchObject({ type: 'forest', treeCount: 2 })
    expect(forest.items).toContainEqual({ label: '树数量', value: '2' })
    expect(boosting.visualization).toMatchObject({ type: 'boosting', learnerCount: 1, learners: [{ feature: 0, threshold: 0.3, polarity: 1, alpha: 0.8 }] })
  })

  it('为非重点模型返回不依赖内部模型结构的基础解释', () => {
    const explanation = createModelExplanation('knn')

    expect(explanation).toMatchObject({ kind: 'knn', level: 'basic', visualization: { type: 'timeline' } })
    expect(explanation.description).toContain('训练时间线')
  })

  it('为可视化 CNN 指向中央可编辑网络画布', () => {
    const explanation = createModelExplanation('visual-cnn')

    expect(explanation.description).toContain('中央网络画布')
    expect(explanation.items).toContainEqual({ label: '可视化内容', value: '可编辑网络结构与分类结果' })
  })
})

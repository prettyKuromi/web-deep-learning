import type { ModelKind } from '../../app/workbenchTypes'
import type { AdaBoostModel, DecisionTreeModel, DecisionTreeNode, LogisticRegressionModel, LinearSvmModel, MlpModel, RandomForestModel } from '../training/types'

export type ExplanationLevel = 'detailed' | 'basic'

export interface ModelExplanationItem {
  label: string
  value: string
}

export interface ModelExplanation {
  kind: ModelKind
  level: ExplanationLevel
  title: string
  description: string
  items: ModelExplanationItem[]
  visualization: Record<string, unknown>
}

const titles: Record<ModelKind, string> = {
  knn: 'K 最近邻', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机',
  'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯', mlp: '多层感知机（MLP）',
  'visual-cnn': '可视化卷积神经网络', 'linear-regression': '线性回归', 'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA',
  lstm: 'LSTM 序列分类', transformer: 'Transformer 序列分类',
}

export function createModelExplanation(kind: ModelKind, model?: unknown): ModelExplanation {
  model = model && typeof model === 'object' ? model : {}
  const safeModel = model
  switch (kind) {
    case 'mlp': return explainMlp(safeModel as Partial<MlpModel>)
    case 'logistic-regression': return explainLinear(model as Partial<LogisticRegressionModel>, kind, '通过 sigmoid 将线性组合转换为类别概率。')
    case 'linear-svm': return explainLinear(model as Partial<LinearSvmModel>, kind, '通过最大化分类间隔来区分样本，训练目标包含 hinge loss。')
    case 'decision-tree': return explainTree(safeModel as Partial<DecisionTreeModel>)
    case 'random-forest': return explainForest(safeModel as Partial<RandomForestModel>)
    case 'adaboost': return explainAdaBoost(safeModel as Partial<AdaBoostModel>)
    case 'lstm': return basicExplanation(kind, '单层 LSTM 按时间步更新门控状态，并用最终隐藏状态完成分类。', [
      { label: '网络结构', value: '输入序列 → LSTM → Softmax 分类' },
      { label: '隐藏单元数', value: String((safeModel as { hiddenSize?: number }).hiddenSize ?? '未训练') },
    ])
    case 'transformer': return basicExplanation(kind, '单层 Transformer 使用位置编码和多头自注意力整合时间步信息，再进行序列分类。', [
      { label: '编码结构', value: '位置编码 → 多头注意力 → 前馈层 → Softmax 分类' },
      { label: '模型维度', value: String((safeModel as { modelDimension?: number }).modelDimension ?? '未训练') },
      { label: '注意力头数', value: String((safeModel as { attentionHeads?: number }).attentionHeads ?? '未训练') },
    ])
    default: return basicExplanation(kind)
  }
}

function explainMlp(model: Partial<MlpModel>): ModelExplanation {
  const layers = Array.isArray(model.layers) ? [...model.layers] : []
  const activation = model.activation ?? 'relu'
  return {
    kind: 'mlp', level: 'detailed', title: titles.mlp,
    description: '逐层前向传播并通过反向传播更新权重，适合学习非线性决策边界。',
    items: [
      { label: '网络结构', value: layers.length ? layers.join(' → ') : '未训练' },
      { label: '激活函数', value: activation },
      { label: '连接层数', value: String(Math.max(0, layers.length - 1)) },
    ],
    visualization: { type: 'neural-network', layers, activation, weights: model.weights ?? [], biases: model.biases ?? [] },
  }
}

function explainLinear(model: Partial<LogisticRegressionModel | LinearSvmModel>, kind: 'logistic-regression' | 'linear-svm', description: string): ModelExplanation {
  const weights = model.weights ?? []
  const dimensions = model.dimensions ?? Math.max(0, (weights[0]?.length ?? 1) - 1)
  const items: ModelExplanationItem[] = [
    { label: '特征维度', value: String(dimensions) },
    { label: '类别数', value: String(model.labels?.length ?? weights.length) },
  ]
  if (kind === 'linear-svm') items.push({ label: '优化目标', value: '最小化 hinge loss，并最大化分类间隔' })
  else items.push({ label: '输出', value: '类别概率与线性决策边界' })
  return {
    kind, level: 'detailed', title: titles[kind], description, items,
    visualization: { type: 'linear-boundary', algorithm: kind, weights, margin: kind === 'linear-svm' ? 1 : undefined },
  }
}

function explainTree(model: Partial<DecisionTreeModel>): ModelExplanation {
  const tree = model.root ? toTreeNode(model.root) : undefined
  const rootRule = model.root ? nodeRule(model.root) : '未训练'
  return {
    kind: 'decision-tree', level: 'detailed', title: titles['decision-tree'],
    description: '每个内部节点按特征阈值递归分裂，叶节点给出最终类别。',
    items: [{ label: '根节点规则', value: rootRule }, { label: '特征维度', value: String(model.dimensions ?? '未知') }],
    visualization: { type: 'tree', tree },
  }
}

function explainForest(model: Partial<RandomForestModel>): ModelExplanation {
  const trees = model.trees ?? []
  return {
    kind: 'random-forest', level: 'detailed', title: titles['random-forest'],
    description: '多个决策树独立训练后进行投票，降低单棵树的方差。',
    items: [{ label: '树数量', value: String(trees.length) }, { label: '投票方式', value: '多数表决' }],
    visualization: { type: 'forest', treeCount: trees.length, trees: trees.map(tree => toTreeNode(tree.root)) },
  }
}

function explainAdaBoost(model: Partial<AdaBoostModel>): ModelExplanation {
  const learners = model.stumps ?? []
  return {
    kind: 'adaboost', level: 'detailed', title: titles.adaboost,
    description: '按轮次串联弱分类器，并提高难分样本的权重。',
    items: [{ label: '弱学习器数量', value: String(learners.length) }, { label: '集成方式', value: '加权投票' }],
    visualization: { type: 'boosting', learnerCount: learners.length, learners },
  }
}

function basicExplanation(kind: ModelKind, description?: string, items?: ModelExplanationItem[]): ModelExplanation {
  return {
    kind, level: 'basic', title: titles[kind],
    description: description ?? (kind === 'visual-cnn' ? '卷积网络结构和层参数可在中央网络画布中编辑；此处汇总训练状态与分类表现。' : '该模型提供统一训练时间线、结果画布和基础指标；内部结构暂不展开。'),
    items: items ?? [{ label: '可视化内容', value: kind === 'visual-cnn' ? '可编辑网络结构与分类结果' : '训练时间线与结果画布' }],
    visualization: { type: 'timeline' },
  }
}

function nodeRule(node: DecisionTreeNode): string {
  return node.feature === undefined || node.threshold === undefined ? `叶节点：${String(node.prediction)}` : `特征 ${node.feature + 1} ≤ ${node.threshold.toFixed(3)}`
}

function toTreeNode(node: DecisionTreeNode): Record<string, unknown> {
  const result: Record<string, unknown> = { prediction: node.prediction, rule: nodeRule(node) }
  if (node.left) result.left = toTreeNode(node.left)
  if (node.right) result.right = toTreeNode(node.right)
  return result
}

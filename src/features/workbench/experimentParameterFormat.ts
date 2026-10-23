import type { ModelKind } from '../../app/workbenchTypes'

const parameterLabels: Record<string, string> = {
  learningRate: '学习率', iterations: '迭代次数', regularization: '正则化强度', epochs: '训练轮数', batchSize: '批大小', seed: '随机种子',
  k: '邻居数（k）', margin: '间隔', trees: '树数量', maxDepth: '最大深度', minSamplesSplit: '最小分裂样本数', rounds: '训练轮数',
  varianceSmoothing: '方差平滑', epsilon: '邻域半径', minPoints: '最小样本数', components: '主成分数量', hiddenLayerCount: '隐藏层数量',
  hiddenUnits: '每层神经元数', layers: '网络层配置', imageShape: '图像尺寸', hiddenSize: '隐藏单元数',
  modelDimension: '模型维度', attentionHeads: '注意力头数', feedForwardSize: '前馈层宽度',
}

export function formatParameterLabel(key: string, modelKind?: ModelKind) {
  return key === 'k' && modelKind === 'k-means' ? '簇数量（k）' : parameterLabels[key] ?? key
}

export function formatParameterValue(key: string, value: unknown) {
  if (key === 'imageShape' && value && typeof value === 'object') {
    const shape = value as Record<string, unknown>
    if (typeof shape.width === 'number' && typeof shape.height === 'number' && typeof shape.channels === 'number') return `${shape.height} × ${shape.width} 像素 · ${shape.channels} 通道`
  }
  if (key === 'layers' && Array.isArray(value)) return value.map((layer, index) => {
    if (!layer || typeof layer !== 'object') return `第 ${index + 1} 层`
    const item = layer as Record<string, unknown>
    const names: Record<string, string> = { conv2d: '卷积层', 'max-pool': '最大池化', dense: '全连接层', activation: '激活层', dropout: 'Dropout' }
    const activations: Record<string, string> = { relu: 'ReLU', tanh: '双曲正切（Tanh）', sigmoid: 'Sigmoid', softmax: 'Softmax', linear: '线性' }
    const detail = item.type === 'conv2d' ? `，${String(item.filters)} 个滤波器` : item.type === 'dense' ? `，${String(item.units)} 个神经元` : item.type === 'activation' ? `，${activations[String(item.activation)] ?? String(item.activation)}` : item.type === 'dropout' ? `，丢弃率 ${Math.round(Number(item.rate) * 100)}%` : ''
    return `第 ${index + 1} 层：${names[String(item.type)] ?? '网络层'}${detail}`
  }).join('；')
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

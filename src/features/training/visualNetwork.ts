import type { ImageShape } from '../datasets/dataset'

export type VisualActivation = 'relu' | 'tanh' | 'sigmoid'
export type VisualLayer =
  | { id: string; type: 'conv2d'; filters: number }
  | { id: string; type: 'max-pool' }
  | { id: string; type: 'dense'; units: number }
  | { id: string; type: 'activation'; activation: VisualActivation }
  | { id: string; type: 'dropout'; rate: number }

export interface VisualLayerDescription {
  id: string
  type: VisualLayer['type']
  name: string
  shape: string
  parameters: number
}

export interface VisualNetworkDescription {
  valid: boolean
  errors: string[]
  layers: VisualLayerDescription[]
  totalParameters: number
}

export function defaultVisualLayers(): VisualLayer[] {
  return [
    { id: 'conv-1', type: 'conv2d', filters: 8 },
    { id: 'activation-1', type: 'activation', activation: 'relu' },
    { id: 'pool-1', type: 'max-pool' },
    { id: 'dense-1', type: 'dense', units: 32 },
    { id: 'activation-2', type: 'activation', activation: 'relu' },
    { id: 'dropout-1', type: 'dropout', rate: 0.1 },
  ]
}

export function describeVisualNetwork(layers: readonly VisualLayer[], imageShape: ImageShape, outputClasses: number): VisualNetworkDescription {
  const errors: string[] = []
  const descriptions: VisualLayerDescription[] = []
  let channels = imageShape.channels
  let height = imageShape.height
  let width = imageShape.width
  let units: number | undefined
  let denseSeen = false
  let trainable = false

  for (const layer of layers) {
    if ((layer.type === 'conv2d' || layer.type === 'max-pool') && denseSeen) errors.push('卷积层和池化层必须位于全连接层之前')
    if (layer.type === 'conv2d') {
      if (!Number.isInteger(layer.filters) || layer.filters < 1 || layer.filters > 32) errors.push('卷积滤波器数量应为 1 到 32 的整数')
      const parameters = (channels * 3 * 3 + 1) * layer.filters
      channels = layer.filters
      descriptions.push({ id: layer.id, type: layer.type, name: `卷积层 · ${layer.filters} 个滤波器`, shape: `${channels}×${height}×${width}`, parameters })
      trainable = true
    } else if (layer.type === 'max-pool') {
      height = Math.floor(height / 2)
      width = Math.floor(width / 2)
      if (height < 1 || width < 1) errors.push('池化后图像尺寸不能小于 1×1')
      descriptions.push({ id: layer.id, type: layer.type, name: '最大池化 · 2×2', shape: `${channels}×${Math.max(height, 0)}×${Math.max(width, 0)}`, parameters: 0 })
    } else if (layer.type === 'dense') {
      if (!Number.isInteger(layer.units) || layer.units < 1 || layer.units > 128) errors.push('全连接神经元数量应为 1 到 128 的整数')
      const inputs = units ?? channels * height * width
      units = layer.units
      denseSeen = true
      descriptions.push({ id: layer.id, type: layer.type, name: `全连接层 · ${layer.units} 个神经元`, shape: String(layer.units), parameters: (inputs + 1) * layer.units })
      trainable = true
    } else if (layer.type === 'activation') {
      descriptions.push({ id: layer.id, type: layer.type, name: `激活层 · ${layer.activation}`, shape: units == null ? `${channels}×${height}×${width}` : String(units), parameters: 0 })
    } else {
      if (!(layer.rate >= 0 && layer.rate <= 0.8)) errors.push('Dropout 丢弃率应在 0 到 0.8 之间')
      descriptions.push({ id: layer.id, type: layer.type, name: `Dropout · ${(layer.rate * 100).toFixed(0)}%`, shape: units == null ? `${channels}×${height}×${width}` : String(units), parameters: 0 })
    }
  }
  if (!trainable) errors.push('至少添加一个卷积层或全连接层')
  const outputInputs = units ?? channels * height * width
  const outputParameters = Math.max(0, outputInputs) * outputClasses + outputClasses
  descriptions.push({ id: 'output', type: 'dense', name: `输出层 · ${outputClasses} 类 Softmax`, shape: String(outputClasses), parameters: outputParameters })
  return { valid: errors.length === 0, errors, layers: descriptions, totalParameters: descriptions.reduce((total, layer) => total + layer.parameters, 0) }
}

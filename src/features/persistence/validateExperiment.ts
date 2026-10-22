import { modelTask, type ExperimentRecord, type ModelKind } from '../../app/workbenchTypes'
import { parameterDefinitions, parameterError } from '../training/modelParameters'
import { describeVisualNetwork, type VisualLayer } from '../training/visualNetwork'
const isObject = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const integer = (value: unknown, min = 0) => finite(value) && Number.isInteger(value) && value >= min
const label = (value: unknown) => typeof value === 'string' && value.length > 0 || finite(value)
const vector = (value: unknown, size?: number): value is number[] => Array.isArray(value) && (size === undefined || value.length === size) && value.every(finite)
const matrix = (value: unknown, rows: number, cols: number) => Array.isArray(value) && value.length === rows && value.every(row => vector(row, cols))
function ensure(condition: unknown, field: string): asserts condition { if (!condition) throw new Error('实验记录' + field + '无效') }
export function validateExperiment(value: unknown): asserts value is ExperimentRecord {
  ensure(isObject(value), '缺少必填字段')
  ensure(['id', 'createdAt', 'dataset', 'modelKind', 'config', 'snapshots', 'predictions'].every(key => key in value), '缺少必填字段')
  ensure(typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 200, '编号')
  ensure((finite(value.createdAt) && value.createdAt >= 0) || typeof value.createdAt === 'string' && Number.isFinite(new Date(value.createdAt).getTime()), '时间')
  ensure(typeof value.modelKind === 'string' && Object.hasOwn(modelTask, value.modelKind), '模型类型')
  const kind = value.modelKind as ModelKind; const task = modelTask[kind]
  const data = value.dataset
  ensure(isObject(data) && Array.isArray(data.features) && data.features.length > 0 && Array.isArray(data.labels) && data.features.length === data.labels.length, '数据集')
  const size = data.features.length; const dimensions = data.features[0]?.length
  ensure(integer(dimensions, 1) && matrix(data.features, size, dimensions) && data.labels.every(label), '数据维度或数值')
  ensure(data.dataType === undefined || ['tabular', 'image'].includes(data.dataType), '数据类型')
  ensure(data.name === undefined || typeof data.name === 'string', '数据名称')
  if (data.dataType === 'image') ensure(isObject(data.imageShape) && ['width', 'height', 'channels'].every(key => integer(data.imageShape[key], 1)) && data.imageShape.width * data.imageShape.height * data.imageShape.channels === dimensions, '图像尺寸')
  ensure(kind !== 'visual-cnn' || data.dataType === 'image', '模型数据类型')
  if (value.runMetadata !== undefined) {
    const metadata = value.runMetadata
    ensure(isObject(metadata), '运行元数据')
    ensure(metadata.status === undefined || ['completed', 'stopped'].includes(metadata.status), '运行状态')
    ensure(metadata.trainingUnit === undefined || ['iteration', 'epoch', 'tree', 'round', 'fit'].includes(metadata.trainingUnit), '训练单位')
    ensure(metadata.startedAt === undefined || finite(metadata.startedAt) && metadata.startedAt >= 0, '开始时间')
    ensure(metadata.completedAt === undefined || finite(metadata.completedAt) && metadata.completedAt >= 0, '结束时间')
    ensure(metadata.durationMs === undefined || finite(metadata.durationMs) && metadata.durationMs >= 0, '训练耗时')
    ensure(metadata.datasetFingerprint === undefined || typeof metadata.datasetFingerprint === 'string', '数据指纹')
  }
  const stopped = value.runMetadata?.status === 'stopped'
  if (stopped) ensure(value.model === undefined && value.metrics === undefined, '停止记录不得包含最终模型或指标')
  ensure(isObject(value.config), '参数')
  for (const [key, entry] of Object.entries(value.config)) {
    const definition = parameterDefinitions[kind].find(item => item.key === key)
    if (definition) ensure(finite(entry) && !parameterError(definition, String(entry)), '参数 ' + key)
    else if (key === 'hiddenLayers' && kind === 'mlp') ensure(Array.isArray(entry) && entry.length > 0 && entry.length <= 5 && entry.every(value => integer(value, 1) && value <= 128), '隐藏层参数')
    else if (key === 'layers' && kind === 'visual-cnn') validateLayers(entry, data.imageShape, new Set(data.labels).size)
    else if (key === 'imageShape' && kind === 'visual-cnn') ensure(isObject(entry) && ['width', 'height', 'channels'].every(key => entry[key] === data.imageShape[key]), '图像参数')
    else ensure(finite(entry), '参数 ' + key)
  }
  ensure(Array.isArray(value.predictions) && (stopped ? value.predictions.length === 0 : value.predictions.length === size), '预测长度')
  if (!stopped && task === 'classification') ensure(value.predictions.every((item: unknown) => data.labels.includes(item)), '预测类别')
  if (!stopped && task === 'regression') ensure(data.labels.every(finite) && vector(value.predictions, size), '回归数值')
  if (!stopped && task === 'clustering') ensure(value.predictions.every((item: unknown) => integer(item, -1)), '分簇标签')
  if (!stopped && task === 'dimensionality-reduction') ensure(isObject(value.model) && Array.isArray(value.model.components) && matrix(value.predictions, size, value.model.components.length), '投影维度')
  ensure(Array.isArray(value.snapshots) && value.snapshots.every((item: unknown) => isObject(item) && integer(item.iteration) && (item.loss === undefined || finite(item.loss)) && (item.network === undefined || Array.isArray(item.network) && item.network.every((layer: unknown) => isObject(layer) && typeof layer.name === 'string' && typeof layer.shape === 'string' && integer(layer.parameters) && finite(layer.activation)))), '训练快照')
  if (value.metrics !== undefined) {
    const metrics = value.metrics
    ensure(task === 'classification' && isObject(metrics) && ['accuracy', 'precision', 'recall', 'f1'].every(key => finite(metrics[key]) && metrics[key] >= 0 && metrics[key] <= 1), '分类指标')
    ensure(Array.isArray(metrics.labels) && metrics.labels.length === new Set(data.labels).size && new Set(metrics.labels).size === metrics.labels.length && metrics.labels.every((item: unknown) => data.labels.includes(item)), '指标类别')
    ensure(matrix(metrics.confusionMatrix, metrics.labels.length, metrics.labels.length) && metrics.confusionMatrix.flat().every((item: unknown) => integer(item)) && metrics.confusionMatrix.flat().reduce((sum: number, item: number) => sum + item, 0) === size, '混淆矩阵')
  }
  if (value.model !== undefined) validateModel(value.model, kind, dimensions, data.labels)
}
function validateLayers(layers: unknown, shape: any, classes: number) {
  ensure(Array.isArray(layers) && layers.length <= 30 && layers.every(item => isObject(item) && typeof item.id === 'string' && ['conv2d', 'max-pool', 'dense', 'activation', 'dropout'].includes(item.type)), '网络结构')
  ensure(describeVisualNetwork(layers as VisualLayer[], shape, classes).valid, '网络结构')
}
function validateModel(model: unknown, kind: ModelKind, dimensions: number, sourceLabels: any[]) {
  ensure(isObject(model) && model.kind === kind, '模型结构')
  const labels = [...new Set(sourceLabels)]
  const classes = labels.length
  const validLabels = () => ensure(Array.isArray(model.labels) && model.labels.length === classes && new Set(model.labels).size === classes && model.labels.every((item: unknown) => labels.includes(item)), '模型类别')
  if (kind !== 'mlp' && kind !== 'visual-cnn' && kind !== 'knn') ensure(model.dimensions === dimensions, '模型维度')
  if (kind === 'knn') { ensure(Array.isArray(model.samples) && matrix(model.samples, model.samples.length, dimensions) && Array.isArray(model.labels) && model.labels.length === model.samples.length && model.labels.every(label) && integer(model.k, 1), '邻居模型'); return }
  if (['logistic-regression', 'linear-svm', 'perceptron'].includes(kind)) { validLabels(); ensure(matrix(model.weights, classes, dimensions + 1), '线性权重'); return }
  if (kind === 'linear-regression' || kind === 'ridge-regression') { ensure(vector(model.weights, dimensions + 1), '回归权重'); return }
  if (kind === 'mlp') {
    validLabels()
    ensure(Array.isArray(model.layers) && model.layers.length >= 2 && model.layers.length <= 7 && model.layers.every((item: unknown) => integer(item, 1)) && model.layers[0] === dimensions && model.layers.at(-1) === classes, '网络维度')
    ensure(['relu', 'tanh', 'sigmoid'].includes(model.activation) && integer(model.seed), '网络参数')
    ensure(Array.isArray(model.weights) && Array.isArray(model.biases) && model.weights.length === model.layers.length - 1 && model.biases.length === model.weights.length && model.weights.every((weights: unknown, index: number) => matrix(weights, model.layers[index + 1], model.layers[index]) && vector(model.biases[index], model.layers[index + 1])), '网络权重形状')
    if (model.means !== undefined) ensure(vector(model.means, dimensions) && vector(model.scales, dimensions) && model.scales.every((value: number) => value > 0), '标准化参数')
    return
  }
  if (kind === 'pca') { ensure(vector(model.means, dimensions) && Array.isArray(model.components) && model.components.length > 0 && model.components.length <= dimensions && matrix(model.components, model.components.length, dimensions) && vector(model.explainedVariance, model.components.length) && model.explainedVariance.every((ratio: number) => ratio >= 0 && ratio <= 1.000001), '主成分模型'); return }
  if (kind === 'k-means') { ensure(Array.isArray(model.centroids) && model.centroids.length > 0 && matrix(model.centroids, model.centroids.length, dimensions), '簇中心'); return }
  if (kind === 'dbscan') { ensure(Array.isArray(model.samples) && matrix(model.samples, model.samples.length, dimensions) && Array.isArray(model.assignments) && model.assignments.length === model.samples.length && model.assignments.every((item: unknown) => integer(item, -1)) && finite(model.epsilon) && model.epsilon > 0, '密度模型'); return }
  if (kind === 'decision-tree') { validateNode(model.root, dimensions, labels); return }
  if (kind === 'random-forest') { validLabels(); ensure(Array.isArray(model.trees) && model.trees.length > 0 && model.trees.length <= 100, '森林'); for (const tree of model.trees) validateModel(tree, 'decision-tree', dimensions, sourceLabels); return }
  if (kind === 'adaboost') { validLabels(); ensure(Array.isArray(model.stumps) && model.stumps.every((item: unknown) => isObject(item) && integer(item.feature) && item.feature < dimensions && finite(item.threshold) && [-1, 1].includes(item.polarity) && finite(item.alpha)), '弱分类器'); return }
  if (kind === 'naive-bayes') { validLabels(); ensure(matrix(model.means, classes, dimensions) && matrix(model.variances, classes, dimensions) && model.variances.flat().every((item: number) => item > 0) && vector(model.priors, classes) && model.priors.every((item: number) => item > 0 && item <= 1), '概率模型'); return }
  if (kind === 'visual-cnn') {
    validLabels()
    ensure(isObject(model.imageShape) && model.imageShape.width * model.imageShape.height * model.imageShape.channels === dimensions && integer(model.seed), '卷积模型尺寸')
    validateLayers(model.layers, model.imageShape, classes)
    ensure(isObject(model.parameters), '卷积参数')
    let channels = model.imageShape.channels; let height = model.imageShape.height; let width = model.imageShape.width; let units = 0
    const check = (key: string, input: number, output: number, count: number) => { const p = model.parameters[key]; ensure(isObject(p) && p.inputSize === input && p.outputSize === output && vector(p.weights, count) && vector(p.biases, output), '卷积权重形状') }
    for (const layer of model.layers) {
      if (layer.type === 'conv2d') { check(layer.id, channels * 9, layer.filters, channels * 9 * layer.filters); channels = layer.filters }
      if (layer.type === 'max-pool') { height = Math.floor(height / 2); width = Math.floor(width / 2) }
      if (layer.type === 'dense') { const input = units || channels * height * width; check(layer.id, input, layer.units, input * layer.units); units = layer.units }
    }
    const input = units || channels * height * width; check('output', input, classes, input * classes)
  }
}
function validateNode(node: unknown, dimensions: number, labels: unknown[], depth = 0) {
  ensure(depth <= 30 && isObject(node) && labels.includes(node.prediction), '决策树节点')
  if (node.feature === undefined) { ensure(node.left === undefined && node.right === undefined, '叶节点'); return }
  ensure(integer(node.feature) && node.feature < dimensions && finite(node.threshold), '决策树分裂')
  validateNode(node.left, dimensions, labels, depth + 1); validateNode(node.right, dimensions, labels, depth + 1)
}

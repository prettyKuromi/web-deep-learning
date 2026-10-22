import type { Dataset } from '../datasets/dataset'
import { modelTask, taskLabels, type ExperimentRecord } from '../../app/workbenchTypes'
import type { TrainingUnit } from '../training/types'
import { experimentMetricGroups } from './experimentMetrics'
import { trainingUnitLabel } from '../training/trainingCapabilities'

/** Stable, explicit serialization used as the identity of a dataset. */
function canonicalDataset(dataset: Dataset): string {
  return JSON.stringify({
    name: dataset.name ?? '',
    features: dataset.features.map(row => row.map(value => Number.isFinite(value) ? value : null)),
    labels: dataset.labels,
  })
}

export async function datasetFingerprint(dataset: Dataset): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return '不可用（浏览器不支持 Web Crypto）'
  try {
    const bytes = new TextEncoder().encode(canonicalDataset(dataset))
    const digest = await subtle.digest('SHA-256', bytes)
    return `sha256:${Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return '不可用（指纹计算失败）'
  }
}

export function createRunMetadata(startedAt: number, completedAt?: number, seed?: number, trainingUnit?: TrainingUnit, status: 'completed' | 'stopped' = 'completed') {
  return {
    ...(seed == null ? {} : { seed }),
    startedAt,
    ...(completedAt == null ? {} : { completedAt, durationMs: Math.max(0, completedAt - startedAt) }),
    ...(trainingUnit ? { trainingUnit } : {}),
    status,
  }
}

const modelNames: Record<string, string> = {
  knn: 'KNN', 'logistic-regression': '逻辑回归', 'linear-svm': '线性 SVM', perceptron: '感知机',
  'decision-tree': '决策树', 'random-forest': '随机森林', adaboost: 'AdaBoost', 'naive-bayes': '朴素贝叶斯',
  mlp: '多层感知机（MLP）', 'visual-cnn': '可视化卷积神经网络', 'linear-regression': '线性回归',
  'ridge-regression': '岭回归', 'k-means': 'K-Means', dbscan: 'DBSCAN', pca: 'PCA',
}

function value(value: unknown): string {
  if (value == null) return '未记录'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function markdown(record: ExperimentRecord, fingerprint: string): string {
  const task = modelTask[record.modelKind]
  const meta = record.runMetadata
  const groups = experimentMetricGroups(record)
  const metrics = groups.map(group => {
    const details = group.metrics.length ? group.metrics.map(item => `${group.source} ${item.label}：${Number(item.value.toFixed(4))}`).join('；') : `${group.source}：指标未记录`
    return `- ${details}${group.sampleCount == null ? '' : `（${group.sampleCount} 条）`}`
  }).join('\n') || '- 没有可用的最终指标'
  const curve = record.snapshots?.map(snapshot => `${snapshot.iteration},${snapshot.loss ?? ''}`).join('\n') || '暂无训练快照'
  const stopped = meta?.status === 'stopped'
  const evaluation = record.evaluation
  const evaluationSource = meta?.evaluation?.source ?? (evaluation ? '训练集/验证集划分' : '全量训练数据')
  const unit = meta?.trainingUnit ? trainingUnitLabel(meta.trainingUnit) : '未记录'
  const lastIteration = record.snapshots.at(-1)?.iteration
  return `# 实验报告\n\n## 实验概览\n\n- 模型：${modelNames[record.modelKind] ?? record.modelKind}\n- 任务：${taskLabels[task]}\n- 运行状态：${stopped ? '训练已停止（不完整）' : meta?.status === 'completed' ? '已完成' : '历史状态未记录'}\n- 数据集：${record.dataset.name ?? '未命名数据集'}\n- 样本数：${record.dataset.features.length}\n- 特征数：${record.dataset.features[0]?.length ?? 0}\n- 数据指纹：${fingerprint}\n- 随机种子：${value(meta?.seed)}\n- 训练单位：${unit}\n- 开始时间：${meta?.startedAt ? new Date(meta.startedAt).toISOString() : '未记录'}\n- 结束时间：${meta?.completedAt ? new Date(meta.completedAt).toISOString() : '未记录'}\n- 训练耗时：${meta?.durationMs == null ? '未记录' : `${meta.durationMs} 毫秒`}\n- 评估来源：${evaluationSource}\n- 训练/验证样本数：${evaluation ? `${value(evaluation.trainSampleCount)} / ${value(evaluation.validationSampleCount)}` : '未设置独立验证集'}\n\n## 训练参数\n\n\`\`\`json\n${JSON.stringify(record.config, null, 2)}\n\`\`\`\n\n## 评估配置\n\n${evaluation ? `验证集划分：${Math.round(evaluation.config.validationSplit * 100)}%，随机种子：${value(evaluation.config.seed)}` : '未启用独立验证集；使用全量数据训练。'}\n\n## 指标（${taskLabels[task]}）\n\n${stopped ? `训练已停止，没有最终结果。已保存 ${record.snapshots.length} 个训练快照${lastIteration == null ? '' : `，最后记录到第 ${lastIteration} 个训练单位`}。` : metrics}\n\n## 训练损失曲线数据\n\n以下为 Worker 实际产生的快照数据（CSV：训练单位序号,损失）：\n\n\`\`\`text\n${curve}\n\`\`\`\n\n## 复现限制\n\n- 报告记录的是浏览器端本次运行结果，不包含代码版本或运行时版本。\n- 旧历史缺失的字段保持“未记录”，不会补造。\n- 指纹仅覆盖规范化后的数据集名称、特征和标签。\n`
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] as string))
}

export async function serializeExperimentReport(record: ExperimentRecord, format: 'markdown' | 'html' = 'markdown'): Promise<string> {
  const fingerprint = record.runMetadata?.datasetFingerprint ?? await datasetFingerprint(record.dataset)
  const content = markdown(record, fingerprint)
  if (format === 'markdown') return content
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>实验报告</title><style>body{font:15px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem;line-height:1.6}pre{background:#f4f6f8;padding:1rem;overflow:auto}h1,h2{color:#172033}</style></head><body><pre style="white-space:pre-wrap;font:inherit">${escapeHtml(content)}</pre></body></html>`
}

export function reportFilename(record: ExperimentRecord, format: 'markdown' | 'html'): string {
  const model = modelNames[record.modelKind] ?? record.modelKind
  return `实验报告-${model}-${record.id}.${format === 'markdown' ? 'md' : 'html'}`
}

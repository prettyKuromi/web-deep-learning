import type { ModelKind, TaskKind } from '../../app/workbenchTypes'
import type { TrainingCapability } from '../training/types'
import { trainingUnitLabel } from '../training/trainingCapabilities'

export type GuidancePage = 'setup' | 'workflow' | 'history'
export type GuidanceCanvasView = 'training' | 'results' | 'architecture'

export interface GuidanceContext {
  page: GuidancePage
  canvasView?: GuidanceCanvasView
  task?: TaskKind
  model?: ModelKind
  trainingStatus?: string
  capability?: TrainingCapability
  evaluationSources?: {
    train?: string
    validation?: string
    result?: string
  }
}

export interface GuidanceChapter {
  id: string
  title: string
  paragraphs: string[]
}

export interface GuidanceContent {
  current: GuidanceChapter
  chapters: GuidanceChapter[]
}

const taskNames: Record<TaskKind, string> = {
  classification: '分类',
  regression: '回归',
  clustering: '聚类',
  'dimensionality-reduction': '降维',
}

const modelNames: Record<ModelKind, string> = {
  knn: 'KNN',
  'logistic-regression': '逻辑回归',
  'linear-svm': '线性 SVM',
  perceptron: '感知机',
  'decision-tree': '决策树',
  'random-forest': '随机森林',
  adaboost: 'AdaBoost',
  'naive-bayes': '朴素贝叶斯',
  'linear-regression': '线性回归',
  'ridge-regression': '岭回归',
  'k-means': 'K-Means',
  dbscan: 'DBSCAN',
  pca: 'PCA',
  mlp: '多层感知机（MLP）',
  'visual-cnn': '可视化卷积神经网络',
  lstm: 'LSTM',
  transformer: 'Transformer',
}

const setupChapter: GuidanceChapter = {
  id: 'setup',
  title: '模型与数据',
  paragraphs: [
    '先选择要解决的任务和模型，再选择兼容的数据集并检查预览。确认数据集后进入实验流程。',
    '更换任务会更新可选模型；更换模型会筛选兼容数据。导入 CSV 前请确认数值特征和分类标签列。',
  ],
}

const historyChapter: GuidanceChapter = {
  id: 'history',
  title: '历史记录',
  paragraphs: [
    '这里保存已完成的实验。选择记录可查看详情，勾选多条记录可比较适用指标、参数和训练信息。',
    '比较结果只展示实际记录且适用于当前任务的指标；JSON 导入和导出用于在本地保存或迁移实验记录。',
  ],
}

function sourceLabel(value?: string): string {
  return value?.trim() || '未记录'
}

function evaluationSourceParagraph(context: GuidanceContext): string {
  return `评估来源：训练集指标使用${sourceLabel(context.evaluationSources?.train)}；验证集指标使用${sourceLabel(context.evaluationSources?.validation)}。`
}

function resultChapter(context: GuidanceContext): GuidanceChapter {
  const paragraphs: string[] = []
  switch (context.task) {
    case 'classification':
      paragraphs.push(
        '准确率表示整体预测正确的比例；宏平均精确率、召回率和 F1 会先分别计算各类别，再对类别等权平均。混淆矩阵按真实类别和预测类别统计。',
        evaluationSourceParagraph(context),
      )
      break
    case 'regression':
      paragraphs.push(
        'MAE 是预测误差绝对值的平均，MSE 会更重地惩罚较大的误差；R² 描述模型对目标变化的拟合程度，数值可能为负。',
        evaluationSourceParagraph(context),
      )
      break
    case 'clustering':
      paragraphs.push(
        context.model === 'dbscan'
          ? '簇数表示发现的非噪声簇数量；噪声标签 -1 表示样本未归入任何簇。聚类结果描述数据分组，不代表分类准确率。'
          : '簇数表示模型将数据划分出的组数；同一簇中的样本按当前模型的相似性规则归组。聚类分组不代表分类准确率。',
        `聚类结果来源：${sourceLabel(context.evaluationSources?.result)}。`,
      )
      break
    case 'dimensionality-reduction':
      paragraphs.push(
        'PCA 投影把特征映射到主成分空间；方差解释率表示各主成分保留的数据变化比例，用于理解降维信息保留情况，不是预测准确率。',
        `解释方差来源：${sourceLabel(context.evaluationSources?.result)}。`,
      )
      break
    default:
      paragraphs.push('选择当前任务后，这里会显示对应结果指标的含义和数据来源。')
  }
  return { id: 'workflow-results', title: '结果与解释', paragraphs }
}

function trainingControlParagraph(context: GuidanceContext): string[] {
  const capability = context.capability
  if (!capability) return []

  const unit = trainingUnitLabel(capability.unit)
  const status = context.trainingStatus
  if (['训练完成', '训练完成，保存失败', '训练已停止', '训练已取消', '训练失败'].includes(status ?? '')) {
    return ['本次训练已结束；可以查看已记录的结果和训练快照。']
  }
  const active = status === '训练中…' || status === '训练已暂停' || status === '准备训练' || status === '初始化模型'
  const paragraphs: string[] = []

  if (status === '训练已暂停') {
    paragraphs.push('当前处于暂停状态。')
    if (capability.canStep) paragraphs.push(`可以单步推进一个${unit}，观察训练变化后再决定是否继续。`)
    if (capability.canPause) paragraphs.push('也可以继续训练；需要提前结束时可停止。')
  } else if (status === '训练中…') {
    if (capability.canPause) paragraphs.push(`训练中可以暂停；暂停会在当前${unit}计算结束后生效。`)
    else paragraphs.push(`当前模型按一次“${unit}”完成训练，不支持暂停和单步。`)
    if (capability.canStep) paragraphs.push(`暂停后可以单步推进一个${unit}。`)
    if (capability.canStop) paragraphs.push('需要提前结束时可以停止计算。')
  } else if (status === '准备训练' || status === '初始化模型' || status === '等待训练') {
    paragraphs.push(capability.canPause
      ? `开始训练后可暂停；单步会完成一个${unit}，便于观察训练变化。`
      : `该模型通过一次“${unit}”完成训练，不支持暂停或单步。`)
  } else if (capability.canPause || capability.canStep) {
    paragraphs.push(`当前模型按${unit}推进；${capability.canPause ? '支持暂停和继续' : '不支持暂停'}${capability.canStep ? `，单步可推进一个${unit}` : ''}。`)
  } else {
    paragraphs.push(`当前模型按“${unit}”完成训练，不支持暂停和单步。`)
  }

  if (active && capability.canStop && status !== '训练中…' && status !== '训练已暂停') {
    paragraphs.push('训练开始后可停止计算。')
  }
  return paragraphs
}

function trainingChapter(context: GuidanceContext): GuidanceChapter {
  const task = context.task ? taskNames[context.task] : undefined
  const model = context.model ? modelNames[context.model] : undefined
  const paragraphs = [
    `训练过程视图显示训练状态、已接收的训练快照和损失变化${task ? `；当前任务为${task}` : ''}${model ? `，模型为${model}` : ''}。`,
    ...trainingControlParagraph(context),
  ]
  if (context.trainingStatus === '训练失败') {
    paragraphs.push('训练失败时先查看错误提示；已有训练快照仍可用于回顾已完成的过程。')
  }
  return { id: 'workflow-training', title: '训练过程', paragraphs }
}

function architectureChapter(context: GuidanceContext): GuidanceChapter {
  const paragraphs = context.model === 'visual-cnn'
    ? [
      '网络结构视图展示卷积、池化和全连接等网络层；调整结构后可查看输出形状与参数量，再开始训练观察结果。',
      '训练中修改结构会影响后续模型配置，若训练正在进行，请先按页面状态完成或停止当前训练。',
    ]
    : ['网络结构视图用于检查可视化 CNN 的网络层；当前模型没有单独的结构编辑视图。']
  return { id: 'workflow-architecture', title: '网络结构', paragraphs }
}

export function getGuidanceContent(context: GuidanceContext): GuidanceContent {
  const view = context.canvasView ?? 'training'
  const workflowChapter = view === 'results'
    ? resultChapter(context)
    : view === 'architecture'
      ? architectureChapter(context)
      : trainingChapter(context)
  const chapters = [setupChapter, workflowChapter, historyChapter]
  const current = context.page === 'setup'
    ? setupChapter
    : context.page === 'history'
      ? historyChapter
      : workflowChapter

  return { current, chapters }
}

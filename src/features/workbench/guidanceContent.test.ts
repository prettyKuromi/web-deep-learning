import { describe, expect, it } from 'vitest'
import type { TrainingCapability } from '../training/types'
import { getGuidanceContent } from './guidanceContent'

const capability = (canPause: boolean, canStep: boolean, unit: TrainingCapability['unit']): TrainingCapability => ({
  unit,
  canPause,
  canStep,
  canStop: true,
})

describe('工作台上下文帮助内容', () => {
  it('模型与数据和历史记录显示各自的推荐操作', () => {
    const setup = getGuidanceContent({ page: 'setup' }).current
    const history = getGuidanceContent({ page: 'history' }).current

    expect(setup.title).toBe('模型与数据')
    expect(setup.paragraphs.join('')).toContain('确认数据集')
    expect(history.title).toBe('历史记录')
    expect(history.paragraphs.join('')).toContain('比较')
  })

  it('工作流帮助随训练、结果和网络结构画布视图切换', () => {
    const training = getGuidanceContent({ page: 'workflow', canvasView: 'training' }).current
    const results = getGuidanceContent({ page: 'workflow', canvasView: 'results', task: 'classification' }).current
    const architecture = getGuidanceContent({ page: 'workflow', canvasView: 'architecture', model: 'visual-cnn' }).current

    expect(training.id).not.toBe(results.id)
    expect(training.paragraphs.join('')).toContain('训练状态')
    expect(results.title).toBe('结果与解释')
    expect(architecture.title).toBe('网络结构')
    expect(architecture.paragraphs.join('')).toContain('卷积')
  })

  it('拟合型 KNN 不显示暂停和单步建议', () => {
    const content = getGuidanceContent({
      page: 'workflow',
      canvasView: 'training',
      model: 'knn',
      capability: capability(false, false, 'fit'),
      trainingStatus: '训练中…',
    }).current.paragraphs.join('')

    expect(content).toContain('不支持暂停和单步')
    expect(content).toContain('停止')
    expect(content).not.toContain('可暂停')
    expect(content).not.toContain('单步推进一个拟合')
  })

  it('迭代型逻辑回归按真实能力说明暂停和单步', () => {
    const content = getGuidanceContent({
      page: 'workflow',
      canvasView: 'training',
      model: 'logistic-regression',
      capability: capability(true, true, 'iteration'),
      trainingStatus: '训练中…',
    }).current.paragraphs.join('')

    expect(content).toContain('暂停会在当前迭代计算结束后生效')
    expect(content).toContain('单步推进一个迭代')
  })

  it('序列 Transformer 使用真实轮次能力并区分暂停状态', () => {
    const content = getGuidanceContent({
      page: 'workflow',
      canvasView: 'training',
      model: 'transformer',
      capability: capability(true, true, 'epoch'),
      trainingStatus: '训练已暂停',
    }).current.paragraphs.join('')

    expect(content).toContain('暂停状态')
    expect(content).toContain('单步推进一个轮次')
  })

  it('训练结束后不再建议暂停、继续或单步', () => {
    const content = getGuidanceContent({
      page: 'workflow',
      canvasView: 'training',
      capability: capability(true, true, 'iteration'),
      trainingStatus: '训练完成',
    }).current.paragraphs.join('')

    expect(content).toContain('本次训练已结束')
    expect(content).not.toContain('暂停和继续')
    expect(content).not.toContain('单步')
  })

  it('分类结果解释指标并只显示传入的评估来源', () => {
    const content = getGuidanceContent({
      page: 'workflow',
      canvasView: 'results',
      task: 'classification',
      evaluationSources: { train: '训练集', validation: '验证集' },
    }).current.paragraphs.join('')

    expect(content).toContain('准确率')
    expect(content).toContain('宏平均')
    expect(content).toContain('混淆矩阵')
    expect(content).toContain('训练集指标使用训练集；验证集指标使用验证集')
  })

  it('回归结果说明 MAE、MSE、R² 和未记录的数据来源', () => {
    const content = getGuidanceContent({
      page: 'workflow',
      canvasView: 'results',
      task: 'regression',
    }).current.paragraphs.join('')

    expect(content).toContain('MAE')
    expect(content).toContain('MSE')
    expect(content).toContain('R²')
    expect(content).toContain('训练集指标使用未记录；验证集指标使用未记录')
  })

  it('聚类与 PCA 结果按任务显示适用解释', () => {
    const clustering = getGuidanceContent({
      page: 'workflow',
      canvasView: 'results',
      task: 'clustering',
      model: 'dbscan',
      evaluationSources: { result: '当前实验记录' },
    }).current.paragraphs.join('')
    const pca = getGuidanceContent({
      page: 'workflow',
      canvasView: 'results',
      task: 'dimensionality-reduction',
      model: 'pca',
    }).current.paragraphs.join('')

    expect(clustering).toContain('簇数')
    expect(clustering).toContain('噪声标签 -1')
    expect(clustering).toContain('当前实验记录')
    expect(pca).toContain('PCA 投影')
    expect(pca).toContain('方差解释率')
    expect(pca).toContain('来源：未记录')
  })

  it('K-Means 聚类说明簇数且不显示 DBSCAN 噪声标签', () => {
    const content = getGuidanceContent({
      page: 'workflow',
      canvasView: 'results',
      task: 'clustering',
      model: 'k-means',
    }).current.paragraphs.join('')

    expect(content).toContain('簇数')
    expect(content).not.toContain('噪声标签 -1')
  })

  it('有选中实验上下文时历史页展示任务指标说明和明确来源', () => {
    const content = getGuidanceContent({
      page: 'history',
      selectedHistoryExperiment: {
        task: 'regression',
        model: 'linear-regression',
        evaluationSources: { train: '训练集', validation: '验证集' },
      },
    }).current

    expect(content.title).toBe('历史记录')
    expect(content.paragraphs.join('')).toContain('MAE')
    expect(content.paragraphs.join('')).toContain('训练集指标使用训练集；验证集指标使用验证集')
  })

  it('历史记录来源缺失时明确标记未记录且不推断', () => {
    const content = getGuidanceContent({
      page: 'history',
      selectedHistoryExperiment: {
        task: 'classification',
        model: 'logistic-regression',
      },
    }).current.paragraphs.join('')

    expect(content).toContain('训练集指标使用未记录；验证集指标使用未记录')
    expect(content).not.toContain('训练集指标使用训练集；验证集指标使用验证集')
  })

  it('历史实验缺少模型和来源时不串用当前实验上下文', () => {
    const content = getGuidanceContent({
      page: 'history',
      model: 'dbscan',
      evaluationSources: { result: '当前 DBSCAN 结果来源' },
      selectedHistoryExperiment: { task: 'clustering' },
    }).current.paragraphs.join('')

    expect(content).not.toContain('噪声标签 -1')
    expect(content).not.toContain('当前 DBSCAN 结果来源')
    expect(content).toContain('聚类结果来源：未记录')
  })

  it('没有选中历史实验时保留通用历史帮助', () => {
    const content = getGuidanceContent({
      page: 'history',
      task: 'classification',
      model: 'logistic-regression',
      evaluationSources: { train: '训练集', validation: '验证集' },
    }).current.paragraphs.join('')

    expect(content).toContain('选择记录可查看详情')
    expect(content).not.toContain('MAE')
    expect(content).not.toContain('混淆矩阵')
  })

  it('CNN 结构视图和训练视图使用相应模型说明', () => {
    const structure = getGuidanceContent({
      page: 'workflow',
      canvasView: 'architecture',
      model: 'visual-cnn',
    }).current.paragraphs.join('')
    const training = getGuidanceContent({
      page: 'workflow',
      canvasView: 'training',
      model: 'visual-cnn',
      capability: capability(true, true, 'epoch'),
    }).current.paragraphs.join('')

    expect(structure).toContain('网络层')
    expect(training).toContain('一个轮次')
  })
})

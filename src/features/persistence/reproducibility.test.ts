import { describe, expect, it, vi } from 'vitest'
import { datasetFingerprint, createRunMetadata, serializeExperimentReport } from './reproducibility'
import type { ExperimentRecord } from '../../app/workbenchTypes'

const base = {
  id: 'x', createdAt: 1,
  dataset: { name: 'demo', features: [[1, 2], [3, 4]], labels: ['a', 'b'] },
  modelKind: 'logistic-regression', config: { iterations: 10, seed: 7 },
  snapshots: [{ iteration: 1, loss: .5 }], predictions: ['a', 'b'],
} as ExperimentRecord

describe('reproducibility', () => {
  it('same dataset yields deterministic sha256 fingerprint', async () => {
    const first = await datasetFingerprint(base.dataset)
    expect(first).toBe(await datasetFingerprint({ ...base.dataset }))
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
  it('保存完成或停止状态、实际训练单位和耗时', () => {
    const createMetadata = createRunMetadata as unknown as (...args: unknown[]) => Record<string, unknown>
    expect(createMetadata(1000, 1250, 7, 'iteration', 'stopped')).toEqual({ seed: 7, startedAt: 1000, completedAt: 1250, durationMs: 250, trainingUnit: 'iteration', status: 'stopped' })
    expect(createMetadata(1000, undefined, 7, 'fit', 'completed').durationMs).toBeUndefined()
  })
  it('指纹计算抛错时明确返回不可用而不是拒绝运行', async () => {
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockRejectedValue(new Error('digest unavailable')) } })
    await expect(datasetFingerprint(base.dataset)).resolves.toMatch(/不可用/)
    vi.unstubAllGlobals()
  })
  it('serializes a readable markdown report', async () => {
    const report = await serializeExperimentReport(base, 'markdown')
    expect(report).toContain('# 实验报告')
    expect(report).toContain('训练损失曲线数据')
    expect(report).toContain('逻辑回归')
  })

  it('回归报告列出真实训练与验证指标、来源、配置和样本规模', async () => {
    const record = {
      ...base,
      modelKind: 'linear-regression',
      evaluation: {
        config: { enabled: true, validationSplit: .25, seed: 42 }, trainSampleCount: 3, validationSampleCount: 1,
        trainMetrics: { mae: .4, mse: .2, r2: .8 }, validationMetrics: { mae: .6, mse: .3, r2: .7 },
      },
      runMetadata: { status: 'completed', trainingUnit: 'iteration', seed: 42, evaluation: { source: '训练集/验证集划分', split: '25%' } },
    } as unknown as ExperimentRecord
    const report = await serializeExperimentReport(record)
    expect(report).toContain('训练集')
    expect(report).toContain('验证集')
    expect(report).toContain('MAE')
    expect(report).toContain('MSE')
    expect(report).toContain('R²')
    expect(report).toContain('评估配置')
    expect(report).toContain('3')
    expect(report).toContain('1')
    expect(report).toContain('25%')
    expect(report).toContain('训练单位：迭代')
    expect(report).toContain('特征数：2')
    expect(report).not.toContain('准确率')
    expect(await serializeExperimentReport(record, 'html')).toContain('验证集 MAE')
  })

  it('聚类与 PCA 报告只展示各自实际可用的指标', async () => {
    const clustering = { ...base, modelKind: 'dbscan', predictions: [-1, 0, 1, 1] } as unknown as ExperimentRecord
    const pca = { ...base, modelKind: 'pca', model: { explainedVariance: [.75, .2] } } as unknown as ExperimentRecord
    const clusterReport = await serializeExperimentReport(clustering)
    const pcaReport = await serializeExperimentReport(pca)
    expect(clusterReport).toContain('簇数')
    expect(clusterReport).toContain('噪声样本数')
    expect(clusterReport).not.toContain('F1')
    expect(clusterReport).not.toContain('准确率')
    expect(pcaReport).toContain('主成分 1 方差解释率')
    expect(pcaReport).toContain('累计方差解释率')
    expect(pcaReport).not.toContain('MAE')
  })

  it('停止报告说明运行不完整且不伪造最终指标', async () => {
    const record = { ...base, predictions: [], snapshots: [{ iteration: 4, loss: .3 }], runMetadata: { status: 'stopped', trainingUnit: 'iteration' } } as unknown as ExperimentRecord
    const report = await serializeExperimentReport(record)
    expect(report).toContain('训练已停止')
    expect(report).toContain('没有最终结果')
    expect(report).toContain('第 4')
    expect(report).not.toContain('准确率：0')
    expect(report).not.toContain('F1：0')
  })
})

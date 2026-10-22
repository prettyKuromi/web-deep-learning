import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExperimentRecord } from '../../app/workbenchTypes'
import {
  deleteExperiment,
  exportExperiments,
  importExperiments,
  listExperiments,
  saveExperiment,
} from './persistence'

const storage = vi.hoisted(() => ({ records: new Map<string, ExperimentRecord>(), fail: false }))
vi.mock('dexie', () => ({ default: class {
  experiments = { bulkPut: async (items: ExperimentRecord[]) => { items.forEach(item => storage.records.set(item.id, item)) }, bulkDelete: async (ids: string[]) => { ids.forEach(id => storage.records.delete(id)) }, delete: async (id: string) => { storage.records.delete(id) }, toArray: async () => [...storage.records.values()] }
  version() { return { stores() {} } }
  async transaction(_mode: unknown, _table: unknown, callback: () => Promise<unknown>) { if (storage.fail) throw new Error('quota'); return callback() }
} }))
const record = (id: string, createdAt = 1): ExperimentRecord => ({
  id,
  createdAt,
  dataset: { features: [[0, 1], [1, 0]], labels: [0, 1], name: '测试数据' },
  modelKind: 'knn',
  config: { k: 3 },
  snapshots: [],
  predictions: [0, 1],
})

describe('实验持久化', () => {
  beforeEach(async () => {
    storage.fail = false; storage.records.clear()
    for (const item of await listExperiments()) await deleteExperiment(item.id)
  })

  it('保存后可按创建时间倒序查询并删除', async () => {
    await saveExperiment(record('old', 1))
    await saveExperiment(record('new', 2))
    expect((await listExperiments()).map((item) => item.id)).toEqual(['new', 'old'])
    await deleteExperiment('new')
    expect((await listExperiments()).map((item) => item.id)).toEqual(['old'])
  })

  it('验证集拆分记录按训练集样本数校验混淆矩阵', async () => {
    const metrics = { accuracy: 1, precision: 1, recall: 1, f1: 1, labels: [0, 1], confusionMatrix: [[1, 0], [0, 0]] }
    const evaluated = {
      ...record('evaluated'), modelKind: 'logistic-regression' as const, config: { iterations: 2 }, metrics,
      evaluation: { config: { enabled: true, validationSplit: .5, seed: 42 }, trainSampleCount: 1, validationSampleCount: 1, trainMetrics: metrics },
    }

    await expect(saveExperiment(evaluated)).resolves.toBeUndefined()
  })

  it('没有验证集划分时混淆矩阵仍须覆盖全量样本', async () => {
    const validMetrics = { accuracy: 1, precision: 1, recall: 1, f1: 1, labels: [0, 1], confusionMatrix: [[1, 0], [0, 1]] }
    const legacy = { ...record('legacy'), metrics: validMetrics }
    await expect(saveExperiment(legacy)).resolves.toBeUndefined()

    const partialMetrics = { ...validMetrics, confusionMatrix: [[1, 0], [0, 0]] }
    await expect(saveExperiment({ ...record('invalid-legacy'), metrics: partialMetrics })).rejects.toThrow('混淆矩阵')
  })

  it('保存停止记录时保留部分快照且不要求最终预测或模型', async () => {
    const stopped = {
      ...record('stopped', 2),
      snapshots: [{ iteration: 3, loss: .4 }], predictions: [],
      runMetadata: { status: 'stopped', trainingUnit: 'iteration', startedAt: 1000, completedAt: 1300, durationMs: 300 },
    } as unknown as ExperimentRecord
    await saveExperiment(stopped)
    expect(await listExperiments()).toEqual([stopped])
  })

  it('导出 JSON 包含版本号，导入后可恢复实验', async () => {
    await saveExperiment(record('a'))
    const json = await exportExperiments()
    expect(JSON.parse(json).version).toBe(1)
    await deleteExperiment('a')
    expect((await importExperiments(json)).map((item) => item.id)).toEqual(['a'])
  })

  it('拒绝错误版本或缺失必填字段，并返回中文错误', async () => {
    await expect(importExperiments('{"version":2,"experiments":[]}')).rejects.toThrow('版本')
    await expect(importExperiments('{"version":1,"experiments":[{}]}')).rejects.toThrow('必填')
  })
})

it('导入任意非法模型或维度时全量拒绝，不部分写入', async () => {
  await saveExperiment(record('original'))
  const before = await listExperiments()
  await expect(importExperiments(JSON.stringify({version: 1, experiments: [record('valid'), {...record('invalid'), modelKind: 'unknown-model'}]}))).rejects.toThrow('模型')
  expect(await listExperiments()).toEqual(before)
  await expect(importExperiments(JSON.stringify({version: 1, experiments: [{...record('invalid'), dataset: {features: [[0, 1], [1]], labels: [0, 1]}}]}))).rejects.toThrow('维度')
})
it('拒绝模型权重形状、预测长度与指标错误', async () => {
  for (const invalid of [
    {...record('bad'), predictions: [0]},
    {...record('bad'), metrics: {accuracy: 5}},
    {...record('bad'), modelKind: 'mlp', model: {kind: 'mlp', layers: [2, 2], labels: [0, 1], weights: [], biases: []}},
  ]) await expect(importExperiments(JSON.stringify({version: 1, experiments: [invalid]}))).rejects.toThrow()
})

it("保存故障不静默冒充持久化", async () => { if (typeof indexedDB === "undefined") return; storage.fail = true; await expect(saveExperiment(record("failure"))).rejects.toThrow("本地存储"); expect(storage.records.size).toBe(0) })

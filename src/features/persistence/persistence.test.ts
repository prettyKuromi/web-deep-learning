import { beforeEach, describe, expect, it } from 'vitest'
import type { ExperimentRecord } from '../../app/workbenchTypes'
import {
  deleteExperiment,
  exportExperiments,
  importExperiments,
  listExperiments,
  saveExperiment,
} from './persistence'

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
    for (const item of await listExperiments()) await deleteExperiment(item.id)
  })

  it('保存后可按创建时间倒序查询并删除', async () => {
    await saveExperiment(record('old', 1))
    await saveExperiment(record('new', 2))
    expect((await listExperiments()).map((item) => item.id)).toEqual(['new', 'old'])
    await deleteExperiment('new')
    expect((await listExperiments()).map((item) => item.id)).toEqual(['old'])
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

import Dexie, { type Table } from 'dexie'
import type { ExperimentRecord } from '../../app/workbenchTypes'

export const EXPERIMENT_JSON_VERSION = 1

class ExperimentDatabase extends Dexie {
  experiments!: Table<ExperimentRecord, string>

  constructor() {
    super('web-deep-learning-experiments')
    this.version(1).stores({ experiments: 'id, createdAt' })
  }
}

const database = new ExperimentDatabase()
const memoryStore = new Map<string, ExperimentRecord>()
let useMemory = typeof indexedDB === 'undefined'

async function withStore<T>(operation: (table: Table<ExperimentRecord, string>) => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (useMemory) return fallback()
  try {
    return await operation(database.experiments)
  } catch {
    useMemory = true
    return fallback()
  }
}

export async function saveExperiment(experiment: ExperimentRecord): Promise<void> {
  validateExperiment(experiment)
  await withStore(
    async (table) => {
      await table.put(experiment)
      const records = await table.orderBy('createdAt').reverse().toArray()
      await Promise.all(records.slice(20).map((item) => table.delete(item.id)))
    },
    () => {
      memoryStore.set(experiment.id, experiment)
      const records = [...memoryStore.values()].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
      for (const item of records.slice(20)) memoryStore.delete(item.id)
    },
  )
}

export async function listExperiments(): Promise<ExperimentRecord[]> {
  return withStore(
    (table) => table.orderBy('createdAt').reverse().toArray(),
    () => [...memoryStore.values()].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)),
  )
}

export async function deleteExperiment(id: string): Promise<void> {
  await withStore(
    (table) => table.delete(id),
    () => {
      memoryStore.delete(id)
    },
  )
}

export async function exportExperiments(experiments?: ExperimentRecord[]): Promise<string> {
  const records = experiments ?? (await listExperiments())
  return JSON.stringify({ version: EXPERIMENT_JSON_VERSION, experiments: records })
}

export async function importExperiments(json: string): Promise<ExperimentRecord[]> {
  let payload: unknown
  try {
    payload = JSON.parse(json)
  } catch {
    throw new Error('导入失败：JSON 格式无效')
  }
  if (!isRecord(payload) || payload.version !== EXPERIMENT_JSON_VERSION) {
    throw new Error(`导入失败：不支持的版本（仅支持版本 ${EXPERIMENT_JSON_VERSION}）`)
  }
  if (!Array.isArray(payload.experiments)) throw new Error('导入失败：缺少必填字段 experiments')
  const records = payload.experiments.map((item) => {
    if (!isRecord(item)) throw new Error('导入失败：实验记录缺少必填字段')
    validateExperiment(item)
    return item as unknown as ExperimentRecord
  })
  for (const item of records) await saveExperiment(item)
  return records
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validateExperiment(value: unknown): asserts value is ExperimentRecord {
  if (!isRecord(value)) throw new Error('实验记录缺少必填字段')
  const required = ['id', 'createdAt', 'dataset', 'modelKind', 'config', 'snapshots', 'predictions']
  if (required.some((key) => !(key in value))) throw new Error('实验记录缺少必填字段')
  if (typeof value.id !== 'string' || !value.id) throw new Error('实验记录字段 id 无效')
  if (!isRecord(value.dataset) || !Array.isArray(value.dataset.features) || !Array.isArray(value.dataset.labels)) {
    throw new Error('实验记录字段 dataset 无效')
  }
  if (!Array.isArray(value.snapshots) || !Array.isArray(value.predictions)) throw new Error('实验记录数组字段无效')
}

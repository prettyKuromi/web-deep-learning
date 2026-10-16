import Dexie, { type Table } from 'dexie'
import type { ExperimentRecord } from '../../app/workbenchTypes'
import { validateExperiment } from './validateExperiment'
export const EXPERIMENT_JSON_VERSION = 1
export const LEGACY_STORAGE_KEY = 'web-deep-learning-workbench'
class ExperimentDatabase extends Dexie {
  experiments!: Table<ExperimentRecord, string>
  constructor() { super('web-deep-learning-experiments'); this.version(1).stores({ experiments: 'id, createdAt' }) }
}
const database = new ExperimentDatabase()
const memoryStore = new Map<string, ExperimentRecord>()
const useMemory = typeof indexedDB === 'undefined'
const newest = (records: ExperimentRecord[]) => records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20)
async function storageOperation<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation() } catch { throw new Error('本地存储操作失败，请检查浏览器存储权限或空间；可先导出 JSON 备份。') }
}
async function writeRecords(records: ExperimentRecord[]) {
  await storageOperation(() => database.transaction('rw', database.experiments, async () => {
    await database.experiments.bulkPut(records)
    const all = await database.experiments.toArray()
    const retained = new Set(newest(all).map(item => item.id))
    await database.experiments.bulkDelete(all.filter(item => !retained.has(item.id)).map(item => item.id))
  }))
}
export async function saveExperiment(experiment: ExperimentRecord): Promise<void> { validateExperiment(experiment); if (useMemory) { memoryStore.set(experiment.id, experiment); return } await writeRecords([experiment]) }
export async function listExperiments(): Promise<ExperimentRecord[]> {
  const records = useMemory ? [...memoryStore.values()] : await storageOperation(() => database.experiments.toArray())
  records.forEach(validateExperiment)
  return newest(records)
}
export async function deleteExperiment(id: string): Promise<void> { if (useMemory) { memoryStore.delete(id); return } await storageOperation(() => database.experiments.delete(id)) }
export async function exportExperiments(experiments?: ExperimentRecord[]): Promise<string> {
  const records = experiments ?? await listExperiments()
  records.forEach(validateExperiment)
  return JSON.stringify({ version: EXPERIMENT_JSON_VERSION, experiments: records }, null, 2)
}
export function parseExperiments(json: string): ExperimentRecord[] {
  let payload: unknown
  try { payload = JSON.parse(json) } catch { throw new Error('导入失败：JSON 格式无效') }
  if (!payload || typeof payload !== 'object' || !('version' in payload) || payload.version !== EXPERIMENT_JSON_VERSION) throw new Error('导入失败：不支持的版本（仅支持版本 1）')
  if (!('experiments' in payload) || !Array.isArray(payload.experiments)) throw new Error('导入失败：缺少必填字段 experiments')
  const records = payload.experiments
  records.forEach(validateExperiment)
  if (new Set(records.map(item => item.id)).size !== records.length) throw new Error('导入失败：记录编号重复')
  return records
}
export async function importExperiments(json: string): Promise<ExperimentRecord[]> {
  const records = parseExperiments(json)
  if (useMemory) { records.forEach(item => memoryStore.set(item.id, item)); return listExperiments() }
  await writeRecords(records)
  return listExperiments()
}
export async function migrateLegacyExperiments(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  let raw: string | null
  try { raw = localStorage.getItem(LEGACY_STORAGE_KEY) } catch { throw new Error('无法读取旧历史；旧数据保留在浏览器 localStorage 中。') }
  if (!raw) return
  let records: ExperimentRecord[]
  try {
    const parsed = JSON.parse(raw)
    records = parsed.state?.experiments ?? parsed.experiments
    if (!Array.isArray(records)) throw new Error()
    records.forEach(validateExperiment)
  } catch { throw new Error('旧历史格式无法自动迁移，原数据保留在 localStorage 的 ' + LEGACY_STORAGE_KEY + ' 键中，请先备份。') }
  const existing = new Set((await listExperiments()).map(item => item.id))
  if (useMemory) records.filter(item => !existing.has(item.id)).forEach(item => memoryStore.set(item.id, item))
  else await writeRecords(records.filter(item => !existing.has(item.id)))
  // 只有事务成功后才移除旧来源；迁移失败始终保留原数据。
  try { localStorage.removeItem(LEGACY_STORAGE_KEY) } catch { throw new Error('旧历史已复制到本地数据库，但旧来源清理失败。') }
}

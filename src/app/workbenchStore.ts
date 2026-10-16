import { create } from 'zustand'
import { generateBuiltinDataset, type Dataset } from '../features/datasets/dataset'
import { listExperiments, migrateLegacyExperiments, LEGACY_STORAGE_KEY } from '../features/persistence/persistence'
import type { Labels } from '../features/training/types'
import { type ExperimentRecord, type ModelConfig, type ModelKind, type TrainingState, type WorkbenchStage } from './workbenchTypes'
const defaultDataset = (): Dataset => generateBuiltinDataset('moons')
const defaultModelConfig = (): ModelConfig => ({ params: {} })
const defaultTraining = (): TrainingState => ({ status: '等待训练', progress: 0, snapshots: [] })
export interface WorkbenchStore {
  activeStage: WorkbenchStage; dataset: Dataset; modelConfig: ModelConfig; training: TrainingState; experiments: ExperimentRecord[]
  setActiveStage: (stage: WorkbenchStage) => void; setDataset: (dataset: Dataset) => void
  setModelConfig: (config: ModelConfig | Partial<ModelConfig>) => void; setTraining: (training: Partial<TrainingState>) => void
  addExperiment: (experiment: ExperimentRecord) => void; mergeExperiments: (records: ExperimentRecord[]) => void
  removeExperiment: (id: string) => void; loadExperiments: () => Promise<void>; reset: () => void
}
const merge = (current: ExperimentRecord[], incoming: ExperimentRecord[]) => [...new Map([...incoming, ...current].map(item => [item.id, item])).values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20)
export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  activeStage: '数据集', dataset: defaultDataset(), modelConfig: defaultModelConfig(), training: defaultTraining(), experiments: [],
  setActiveStage: activeStage => set({ activeStage }),
  setDataset: dataset => set({ dataset, training: defaultTraining() }),
  setModelConfig: config => set(state => ({ modelConfig: { ...state.modelConfig, ...config, params: config.kind && config.kind !== state.modelConfig.kind ? { ...config.params } : { ...state.modelConfig.params, ...config.params } } })),
  setTraining: training => set(state => ({ training: { ...state.training, ...training } })),
  addExperiment: experiment => set(state => ({ experiments: merge(state.experiments, [experiment]) })),
  mergeExperiments: records => set(state => ({ experiments: merge(state.experiments, records) })),
  removeExperiment: id => set(state => ({ experiments: state.experiments.filter(item => item.id !== id) })),
  async loadExperiments() { get().mergeExperiments(await listExperiments()); await migrateLegacyExperiments(); get().mergeExperiments(await listExperiments()) },
  reset: () => set({ activeStage: '数据集', dataset: defaultDataset(), modelConfig: defaultModelConfig(), training: defaultTraining(), experiments: [] }),
}))
export const WORKBENCH_STORAGE_KEY = LEGACY_STORAGE_KEY
export const workbenchStore = useWorkbenchStore
export type PredictionLabels = Labels
export type { ExperimentRecord, ModelConfig, ModelKind, TrainingState }

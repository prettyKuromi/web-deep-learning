import { create } from 'zustand'
import { generateBuiltinDataset, type Dataset } from '../features/datasets/dataset'
import type { Labels } from '../features/training/types'
import {
  type ExperimentRecord,
  type ModelConfig,
  type ModelKind,
  type TrainingState,
  type WorkbenchStage,
} from './workbenchTypes'

const STORAGE_KEY = 'web-deep-learning-workbench'

const defaultDataset = (): Dataset => generateBuiltinDataset('moons')
const defaultModelConfig = (): ModelConfig => ({ params: {} })
const defaultTraining = (): TrainingState => ({ status: '等待训练', progress: 0, snapshots: [] })

export interface WorkbenchStore {
  activeStage: WorkbenchStage
  dataset: Dataset
  modelConfig: ModelConfig
  training: TrainingState
  experiments: ExperimentRecord[]
  setActiveStage: (stage: WorkbenchStage) => void
  setDataset: (dataset: Dataset) => void
  setModelConfig: (config: ModelConfig | Partial<ModelConfig>) => void
  setTraining: (training: Partial<TrainingState>) => void
  addExperiment: (experiment: ExperimentRecord) => void
  loadExperiments: () => void
  reset: () => void
}

function persist(experiments: ExperimentRecord[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { experiments }, experiments }))
}

function readExperiments(): ExperimentRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { state?: { experiments?: ExperimentRecord[] }; experiments?: ExperimentRecord[] }
    const records = parsed.state?.experiments ?? parsed.experiments ?? []
    return Array.isArray(records) ? records.slice(0, 20) : []
  } catch {
    return []
  }
}

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  activeStage: '数据集',
  dataset: defaultDataset(),
  modelConfig: defaultModelConfig(),
  training: defaultTraining(),
  experiments: readExperiments(),
  setActiveStage: (activeStage) => set({ activeStage }),
  setDataset: (dataset) => set({ dataset, training: defaultTraining() }),
  setModelConfig: (config) => set((state) => ({ modelConfig: { ...state.modelConfig, ...config, params: { ...state.modelConfig.params, ...(config as Partial<ModelConfig>).params } } })),
  setTraining: (training) => set((state) => ({ training: { ...state.training, ...training } })),
  addExperiment: (experiment) => {
    const experiments = [experiment, ...get().experiments].slice(0, 20)
    set({ experiments })
    persist(experiments)
  },
  loadExperiments: () => set({ experiments: readExperiments() }),
  reset: () => {
    const experiments = readExperiments()
    set({ activeStage: '数据集', dataset: defaultDataset(), modelConfig: defaultModelConfig(), training: defaultTraining(), experiments })
  },
}))

export const WORKBENCH_STORAGE_KEY = STORAGE_KEY
export const workbenchStore = useWorkbenchStore

export type PredictionLabels = Labels
export type { ExperimentRecord, ModelConfig, ModelKind, TrainingState }

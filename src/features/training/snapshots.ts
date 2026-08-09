import type { TrainSnapshot } from './types'

export type TrainingControlStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed'
export interface TrainingControlState {
  status: TrainingControlStatus
  step: number
}
export type TrainingControlEvent = 'start' | 'pause' | 'resume' | 'step' | 'stop' | 'complete' | 'reset'

export function normalizeTrainSnapshot(snapshot: TrainSnapshot, timestamp = Date.now()): TrainSnapshot & { step: number; timestamp: number } {
  return {
    ...snapshot,
    step: snapshot.step ?? snapshot.iteration,
    timestamp: snapshot.timestamp ?? timestamp,
  }
}

export function selectKeySnapshots(snapshots: readonly TrainSnapshot[], limit = 20): TrainSnapshot[] {
  if (limit <= 0 || snapshots.length === 0) return []
  const ordered = [...snapshots]
    .map((snapshot, index) => ({ snapshot: normalizeTrainSnapshot(snapshot, index), index }))
    .sort((a, b) => (a.snapshot.step - b.snapshot.step) || (a.index - b.index))
  const unique = ordered.filter((item, index) => index === 0 || item.snapshot.step !== ordered[index - 1].snapshot.step).map(item => item.snapshot)
  if (unique.length <= limit) return unique
  const result: TrainSnapshot[] = []
  for (let index = 0; index < limit; index++) {
    const sourceIndex = Math.round(index * (unique.length - 1) / (limit - 1))
    result.push(unique[sourceIndex])
  }
  return result
}

export function transitionTrainingState(state: TrainingControlState, event: TrainingControlEvent): TrainingControlState {
  switch (event) {
    case 'start': return state.status === 'idle' || state.status === 'stopped' ? { status: 'running', step: state.step } : state
    case 'pause': return state.status === 'running' ? { ...state, status: 'paused' } : state
    case 'resume': return state.status === 'paused' ? { ...state, status: 'running' } : state
    case 'step': return state.status === 'paused' ? { ...state, step: state.step + 1 } : state
    case 'stop': return state.status === 'running' || state.status === 'paused' ? { ...state, status: 'stopped' } : state
    case 'complete': return state.status === 'running' || state.status === 'paused' ? { ...state, status: 'completed' } : state
    case 'reset': return { status: 'idle', step: 0 }
  }
}

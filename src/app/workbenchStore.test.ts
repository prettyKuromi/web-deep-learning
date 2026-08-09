import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkbenchStore } from './workbenchStore'

describe('workbench store', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.getState().reset()
  })

  it('does not select a model initially or after reset', () => {
    expect(useWorkbenchStore.getState().modelConfig.kind).toBeUndefined()
    useWorkbenchStore.getState().setModelConfig({ kind: 'knn', params: { k: 5 } })
    useWorkbenchStore.getState().reset()
    expect(useWorkbenchStore.getState().modelConfig.kind).toBeUndefined()
  })

  it('provides workflow state and updates active stage', () => {
    const store = useWorkbenchStore.getState()
    expect(store.activeStage).toBe('数据集')
    store.setActiveStage('结果')
    expect(useWorkbenchStore.getState().activeStage).toBe('结果')
  })

  it('keeps only the latest 20 experiments and persists them', () => {
    const add = useWorkbenchStore.getState().addExperiment
    for (let index = 0; index < 21; index += 1) {
      add({ id: String(index), createdAt: index, dataset: { features: [[index, index]], labels: [index] }, modelKind: 'knn', config: { k: 3 }, metrics: undefined, snapshots: [], model: undefined, predictions: [] })
    }
    const experiments = useWorkbenchStore.getState().experiments
    expect(experiments).toHaveLength(20)
    expect(experiments[0].id).toBe('20')
    const saved = JSON.parse(localStorage.getItem('web-deep-learning-workbench') ?? '{}')
    expect(saved.experiments).toHaveLength(20)
  })

  it('restores experiments from localStorage on load', () => {
    localStorage.setItem('web-deep-learning-workbench', JSON.stringify({ state: { experiments: [{ id: 'saved' }] } }))
    useWorkbenchStore.getState().loadExperiments()
    expect(useWorkbenchStore.getState().experiments[0].id).toBe('saved')
  })
})

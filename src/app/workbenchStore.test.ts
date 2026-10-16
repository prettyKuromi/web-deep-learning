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

  it('仅在会话保存最近 20 条，不双写 localStorage', () => {
    const add = useWorkbenchStore.getState().addExperiment
    for (let index = 0; index < 21; index += 1) {
      add({ id: String(index), createdAt: index, dataset: { features: [[index, index]], labels: [index] }, modelKind: 'knn', config: { k: 3 }, metrics: undefined, snapshots: [], model: undefined, predictions: [] })
    }
    const experiments = useWorkbenchStore.getState().experiments
    expect(experiments).toHaveLength(20)
    expect(experiments[0].id).toBe('20')
    expect(localStorage.getItem('web-deep-learning-workbench')).toBeNull()
  })

  it('合并加载的历史不会覆盖会话中新完成的记录', () => {
    const current = { id: 'current', createdAt: 2 } as never
    useWorkbenchStore.getState().addExperiment(current)
    useWorkbenchStore.getState().mergeExperiments([{id: 'saved', createdAt: 1} as never])
    expect(useWorkbenchStore.getState().experiments.map(item => item.id)).toEqual(['current', 'saved'])
  })
})

it('切换模型时替换参数，不混入旧模型参数', () => {
  useWorkbenchStore.getState().setModelConfig({kind: 'knn', params: {k: 9}})
  useWorkbenchStore.getState().setModelConfig({kind: 'linear-regression', params: {iterations: 500}})
  expect(useWorkbenchStore.getState().modelConfig.params).toEqual({iterations: 500})
})

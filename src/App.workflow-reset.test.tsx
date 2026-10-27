import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { useWorkbenchStore } from './app/workbenchStore'
import { generateBuiltinDataset } from './features/datasets/dataset'

describe('实验流程重新进入', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.getState().reset()
    useWorkbenchStore.getState().setDataset(generateBuiltinDataset('moons'))
  })

  it('从其他导航页返回实验流程时清空上一轮运行状态', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))
    const dataset = useWorkbenchStore.getState().dataset
    const modelConfig = useWorkbenchStore.getState().modelConfig
    act(() => useWorkbenchStore.getState().setTraining({
      status: '训练完成', progress: 100, snapshots: [{ iteration: 1, loss: 0.2 }],
      error: '上一轮错误', metrics: { accuracy: 1, precision: 1, recall: 1, f1: 1, labels: [0], confusionMatrix: [[1]] }, runId: 'previous-run',
    }))

    await user.click(screen.getByRole('tab', { name: '历史记录' }))
    await user.click(screen.getByRole('tab', { name: '实验流程' }))

    expect(useWorkbenchStore.getState().training).toMatchObject({ status: '等待训练', progress: 0, snapshots: [] })
    expect(useWorkbenchStore.getState().training.error).toBeUndefined()
    expect(useWorkbenchStore.getState().training.metrics).toBeUndefined()
    expect(useWorkbenchStore.getState().training.runId).toBeUndefined()
    expect(useWorkbenchStore.getState().dataset).toBe(dataset)
    expect(useWorkbenchStore.getState().modelConfig).toEqual(modelConfig)
  })

  it('再次确认模型与数据进入实验流程时清空上一轮运行状态', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))
    act(() => useWorkbenchStore.getState().setTraining({
      status: '训练已停止', progress: 45, snapshots: [{ iteration: 3, loss: 0.4 }], runId: 'stopped-run',
    }))
    await user.click(screen.getByRole('button', { name: '更换数据集' }))
    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))

    expect(useWorkbenchStore.getState().training).toMatchObject({ status: '等待训练', progress: 0, snapshots: [] })
    expect(useWorkbenchStore.getState().training.runId).toBeUndefined()
  })

  it('模型能力提示排在粘性训练按钮栏之前', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))

    const hint = screen.getByText(/该模型按“.*”完成，不支持暂停、继续或单步；可停止计算。/)
    const controls = screen.getByLabelText('训练控制')
    expect(hint.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

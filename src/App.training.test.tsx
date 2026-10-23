import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useWorkbenchStore } from './app/workbenchStore'

class ControlledTrainingWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  private readonly runId = 'controlled-run'
  private readonly capability = { unit: 'iteration' as const, total: 5000, canPause: true, canStep: true, canStop: true }

  postMessage(message: { type: string }) {
    if (message.type === 'start') {
      this.sendEvent('started')
      for (let iteration = 1; iteration <= 16; iteration++) this.sendSnapshot(iteration)
    } else if (message.type === 'pause') this.sendEvent('paused')
    else if (message.type === 'step') {
      this.sendSnapshot(17)
      this.sendEvent('step-completed')
    } else if (message.type === 'resume') {
      this.sendEvent('resumed')
      this.sendSnapshot(18)
    } else if (message.type === 'stop') {
      this.sendEvent('stopped')
      this.emit({ type: 'stopped', runId: this.runId })
    }
  }

  terminate() {}

  private sendEvent(type: string) {
    this.emit({ type: 'event', event: { type, runId: this.runId, capability: this.capability } })
  }

  private sendSnapshot(iteration: number) {
    this.emit({ type: 'snapshot', runId: this.runId, snapshot: { iteration, loss: 1 / iteration }, capability: this.capability })
  }

  private emit(data: unknown) { this.onmessage?.({ data } as MessageEvent) }
}

describe('训练运行记录', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
  beforeEach(() => { localStorage.clear(); useWorkbenchStore.getState().reset() })

  it('暂停与单步确认会刷新最后快照，停止后保存不完整运行记录', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('Worker', ControlledTrainingWorker)
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    render(<App />)
    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '具体模型' }), 'logistic-regression')
    await user.clear(screen.getByRole('spinbutton', { name: '迭代次数' }))
    await user.type(screen.getByRole('spinbutton', { name: '迭代次数' }), '5000')
    await user.click(screen.getByRole('button', { name: '开始训练' }))
    const liveIteration = () => screen.getByLabelText('实时训练反馈').querySelector('strong')
    await waitFor(() => expect(liveIteration()).toHaveTextContent('第 1 / 5000'))

    await user.click(screen.getByRole('button', { name: '暂停' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('训练已暂停'))
    expect(liveIteration()).toHaveTextContent('第 16 / 5000')
    await user.click(screen.getByRole('button', { name: '单步' }))
    await waitFor(() => expect(liveIteration()).toHaveTextContent('第 17 / 5000'))
    expect(screen.getByRole('status')).toHaveTextContent('训练已暂停')

    await user.click(screen.getByRole('button', { name: '继续' }))
    await waitFor(() => expect(document.querySelector('.single-page-status')).toHaveTextContent('训练中…'))
    await user.click(screen.getByRole('button', { name: '停止' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('训练已停止'))
    await waitFor(() => expect(useWorkbenchStore.getState().experiments).toHaveLength(1))
    const stoppedRecord = useWorkbenchStore.getState().experiments[0]
    expect(stoppedRecord.runMetadata).toEqual(expect.objectContaining({ status: 'stopped', trainingUnit: 'iteration', startedAt: 1000, completedAt: 1000, durationMs: 0 }))
    expect(stoppedRecord.snapshots.at(-1)?.iteration).toBe(18)
    expect(stoppedRecord.model).toBeUndefined()
    expect(stoppedRecord.metrics).toBeUndefined()
    expect(stoppedRecord.predictions).toEqual([])

    await user.click(screen.getByRole('tab', { name: '历史记录' }))
    await user.click(screen.getByRole('button', { name: /选择实验记录：月牙形 · 逻辑回归/ }))
    const detail = screen.getByLabelText('实验详情')
    expect(detail).toHaveTextContent('训练已停止')
    expect(within(detail).queryByRole('region', { name: '当前结果' })).not.toBeInTheDocument()
  })

  it('从准备页选择 LSTM 后使用内置时序数据并完成分类训练', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByRole('combobox', { name: '具体模型' }), 'lstm')
    await waitFor(() => expect(screen.getByRole('combobox', { name: '内置数据集' })).toHaveValue('sequence-waves'))
    expect(screen.queryByLabelText('上传 CSV')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认数据集并进入实验流程' }))
    await user.clear(screen.getByRole('spinbutton', { name: '隐藏单元数' }))
    await user.type(screen.getByRole('spinbutton', { name: '隐藏单元数' }), '2')
    await user.clear(screen.getByRole('spinbutton', { name: '训练轮数' }))
    await user.type(screen.getByRole('spinbutton', { name: '训练轮数' }), '1')
    await user.clear(screen.getByRole('spinbutton', { name: '批大小' }))
    await user.type(screen.getByRole('spinbutton', { name: '批大小' }), '128')
    await user.click(screen.getByRole('button', { name: '开始训练' }))

    await waitFor(() => expect(document.querySelector('.single-page-status')).toHaveTextContent('训练完成'), { timeout: 15000 })
    const record = useWorkbenchStore.getState().experiments.at(-1)
    expect(record).toMatchObject({ modelKind: 'lstm', dataset: { dataType: 'sequence', sequenceShape: { steps: 32, channels: 1 } } })
    expect(record?.metrics?.labels).toHaveLength(4)
    expect(record?.snapshots).toHaveLength(1)
  })
})

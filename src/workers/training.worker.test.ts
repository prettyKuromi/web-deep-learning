import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateBuiltinDataset } from '../features/datasets/dataset'

type WorkerScope = { onmessage: ((event: { data: Record<string, unknown> }) => Promise<void>) | null }

const originalOnMessage = (globalThis as unknown as WorkerScope).onmessage

afterEach(() => {
  ;(globalThis as unknown as WorkerScope).onmessage = originalOnMessage
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('训练 Worker 控制事件', () => {
  it('单步完成事件在对应快照之后发送', async () => {
    const messages: Array<Record<string, any>> = []
    vi.stubGlobal('postMessage', (message: Record<string, any>) => messages.push(message))
    vi.resetModules()
    await import('./training.worker')
    const scope = globalThis as unknown as WorkerScope
    const start = scope.onmessage!({ data: {
      type: 'start',
      runId: 'step-test',
      config: { kind: 'logistic-regression', samples: [[0], [1], [2], [3]], labels: ['a', 'a', 'b', 'b'], iterations: 3 },
    } })
    await scope.onmessage!({ data: { type: 'pause' } })
    await vi.waitFor(() => expect(messages.some(message => message.event?.type === 'paused')).toBe(true))
    await scope.onmessage!({ data: { type: 'step' } })
    await vi.waitFor(() => expect(messages.some(message => message.event?.type === 'step-completed')).toBe(true))

    const stepIndex = messages.findIndex(message => message.event?.type === 'step-completed')
    expect(messages[stepIndex - 1]).toMatchObject({ type: 'snapshot', snapshot: { iteration: 1 } })
    await scope.onmessage!({ data: { type: 'stop' } })
    await start
  })

  it.each(['lstm', 'transformer'] as const)('%s 可通过 Worker 暂停、单步并停止', async kind => {
    const dataset = generateBuiltinDataset('sequence-waves', { samples: 8, seed: 17 })
    const config = kind === 'lstm'
      ? { kind, samples: dataset.features, labels: dataset.labels, sequenceShape: dataset.sequenceShape!, hiddenSize: 2, learningRate: 0.03, epochs: 2, batchSize: 4, seed: 42 }
      : { kind, samples: dataset.features, labels: dataset.labels, sequenceShape: dataset.sequenceShape!, modelDimension: 4, attentionHeads: 2, feedForwardSize: 8, learningRate: 0.01, epochs: 2, batchSize: 4, seed: 42 }
    const messages: Array<Record<string, any>> = []
    vi.stubGlobal('postMessage', (message: Record<string, any>) => messages.push(message))
    vi.resetModules()
    await import('./training.worker')
    const scope = globalThis as unknown as WorkerScope
    const start = scope.onmessage!({ data: { type: 'start', runId: `${kind}-control-test`, config } })
    await scope.onmessage!({ data: { type: 'pause' } })
    await vi.waitFor(() => expect(messages.some(message => message.event?.type === 'paused')).toBe(true))
    await scope.onmessage!({ data: { type: 'step' } })
    await vi.waitFor(() => expect(messages.some(message => message.event?.type === 'step-completed')).toBe(true))
    expect(messages.some(message => message.type === 'snapshot')).toBe(true)
    await scope.onmessage!({ data: { type: 'stop' } })
    await start
    expect(messages.some(message => message.type === 'stopped')).toBe(true)
  })
})

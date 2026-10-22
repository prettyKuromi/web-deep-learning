import { afterEach, describe, expect, it, vi } from 'vitest'

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
})

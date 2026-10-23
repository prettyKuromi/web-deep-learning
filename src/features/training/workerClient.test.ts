import { describe, expect, it, vi } from 'vitest'
import { createTrainInWorkerClient, runTrainingInHandler, type WorkerLike } from './workerClient'
import { defaultVisualLayers } from './visualNetwork'

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  messages: unknown[] = []
  postMessage(message: unknown) {
    this.messages.push(message)
  }
  terminate = vi.fn()
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

describe('trainInWorker client', () => {
  it('routes mlp configs through the training handler', async () => {
    const result = await runTrainingInHandler({
      kind: 'mlp',
      samples: [[0, 0], [0, 1], [1, 0], [1, 1]],
      labels: ['no', 'yes', 'yes', 'no'],
      hiddenLayers: [4],
      epochs: 2,
      seed: 7,
    })
    expect(result.model.kind).toBe('mlp')
  })

  it('routes visual cnn configs through the training handler', async () => {
    const result = await runTrainingInHandler({
      kind: 'visual-cnn', samples: Array.from({ length: 10 }, (_, index) => Array(64).fill(index % 2)), labels: Array.from({ length: 10 }, (_, index) => index),
      imageShape: { width: 8, height: 8, channels: 1 }, layers: defaultVisualLayers(), epochs: 1, seed: 7,
    })
    expect(result.model.kind).toBe('visual-cnn')
  })

  it('sends start and resolves on complete while forwarding snapshots', async () => {
    const worker = new FakeWorker()
    const snapshots: unknown[] = []
    const promise = createTrainInWorkerClient(() => worker).trainInWorker(
      { kind: 'knn', samples: [[0]], labels: ['a'], k: 1 },
      snapshot => snapshots.push(snapshot),
    )
    expect(worker.messages).toEqual([{ type: 'start', config: { kind: 'knn', samples: [[0]], labels: ['a'], k: 1 } }])
    worker.emit({ type: 'start' })
    worker.emit({ type: 'snapshot', snapshot: { iteration: 0 } })
    worker.emit({ type: 'complete', result: { model: { kind: 'knn' }, snapshots: [{ iteration: 0 }] } })
    await expect(promise).resolves.toEqual({ model: { kind: 'knn' }, snapshots: [{ iteration: 0 }] })
    expect(snapshots).toEqual([{ iteration: 0 }])
  })

  it('uses one run id across Worker snapshots and terminal events', async () => {
    const worker = new FakeWorker()
    const events: any[] = []
    const promise = createTrainInWorkerClient(() => worker).trainInWorker(
      { kind: 'logistic-regression', samples: [[0]], labels: ['a'], iterations: 2 },
      undefined,
      undefined,
      undefined,
      event => events.push(event),
    )
    const start = worker.messages[0] as { type: string; config: unknown }
    expect(start.type).toBe('start')
    const preparing = { type: 'preparing', runId: 'run-1', capability: { unit: 'iteration', total: 2, canPause: true, canStep: true, canStop: true } }
    worker.emit({ type: 'event', event: preparing })
    worker.emit({ type: 'snapshot', runId: preparing.runId, snapshot: { iteration: 1 } })
    worker.emit({ type: 'complete', runId: preparing.runId, result: { model: { kind: 'logistic-regression' }, snapshots: [] } })
    await promise
    expect(events.map(event => event.type)).toEqual(['preparing', 'snapshot', 'completed'])
    expect(events.every(event => event.runId === preparing.runId)).toBe(true)
  })

  it('posts cancel and rejects when signal is aborted', async () => {
    const worker = new FakeWorker()
    const controller = new AbortController()
    const promise = createTrainInWorkerClient(() => worker).trainInWorker(
      { kind: 'knn', samples: [[0]], labels: ['a'], k: 1 },
      undefined,
      controller.signal,
    )
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.messages.at(-1)).toEqual({ type: 'cancel' })
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('stops immediately when the Worker does not respond and ignores late messages', async () => {
    const worker = new FakeWorker()
    const events: any[] = []
    const client = createTrainInWorkerClient(() => worker)
    const promise = client.trainInWorker(
      { kind: 'logistic-regression', samples: [[0]], labels: ['a'], iterations: 2 },
      undefined,
      undefined,
      undefined,
      event => events.push(event),
    )

    worker.emit({ type: 'event', event: { type: 'started', runId: 'worker-run-7', capability: { unit: 'iteration', total: 2, canPause: true, canStep: true, canStop: true } } })
    client.sendControl('stop')

    expect(events.filter(event => event.type === 'stopped')).toEqual([
      expect.objectContaining({ type: 'stopped', runId: 'worker-run-7' }),
    ])
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })

    client.sendControl('stop')
    worker.emit({ type: 'complete', runId: 'worker-run-7', result: { model: { kind: 'logistic-regression' }, snapshots: [] } })
    worker.emit({ type: 'snapshot', runId: 'worker-run-7', snapshot: { iteration: 2 } })
    expect(events.filter(event => ['stopped', 'completed', 'snapshot'].includes(event.type))).toHaveLength(1)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('uses the local run id before receiving a Worker run id and keeps other controls as messages', async () => {
    const worker = new FakeWorker()
    const events: any[] = []
    const client = createTrainInWorkerClient(() => worker)
    const promise = client.trainInWorker(
      { kind: 'logistic-regression', samples: [[0]], labels: ['a'], iterations: 2 },
      undefined,
      undefined,
      undefined,
      event => events.push(event),
    )

    client.sendControl('pause')
    client.sendControl('resume')
    client.sendControl('step')
    expect(worker.messages.slice(1)).toEqual([{ type: 'pause' }, { type: 'resume' }, { type: 'step' }])
    client.sendControl('stop')
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(expect.objectContaining({ type: 'stopped', runId: expect.any(String) }))
    expect(events[0].runId.length).toBeGreaterThan(0)
  })

  it('settles the stop promise even if the stopped listener throws', async () => {
    const worker = new FakeWorker()
    const listenerError = new Error('监听器异常')
    let settledError: unknown
    const client = createTrainInWorkerClient(() => worker)
    const promise = client.trainInWorker(
      { kind: 'logistic-regression', samples: [[0]], labels: ['a'], iterations: 2 },
      undefined,
      undefined,
      undefined,
      event => { if (event.type === 'stopped') throw listenerError },
    ).catch(error => { settledError = error })

    expect(() => client.sendControl('stop')).toThrow(listenerError)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(settledError).toMatchObject({ name: 'AbortError' })
    await promise
  })

  it('rejects with worker errors', async () => {
    const worker = new FakeWorker()
    const promise = createTrainInWorkerClient(() => worker).trainInWorker(
      { kind: 'knn', samples: [[0]], labels: ['a'], k: 1 },
    )
    worker.emit({ type: 'error', error: '训练失败' })
    await expect(promise).rejects.toThrow('训练失败')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createTrainInWorkerClient, runTrainingInHandler, type WorkerLike } from './workerClient'

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

  it('rejects with worker errors', async () => {
    const worker = new FakeWorker()
    const promise = createTrainInWorkerClient(() => worker).trainInWorker(
      { kind: 'knn', samples: [[0]], labels: ['a'], k: 1 },
    )
    worker.emit({ type: 'error', error: '训练失败' })
    await expect(promise).rejects.toThrow('训练失败')
  })
})

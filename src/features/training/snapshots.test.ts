import { describe, expect, it } from 'vitest'
import {
  normalizeTrainSnapshot,
  selectKeySnapshots,
  transitionTrainingState,
  type TrainingControlEvent,
  type TrainingControlState,
} from './snapshots'
import { createTrainInWorkerClient, type WorkerLike } from './workerClient'

describe('训练快照工具', () => {
  it('补齐 step 与时间戳，同时保留旧快照字段', () => {
    const snapshot = normalizeTrainSnapshot({ iteration: 3, loss: 0.2 }, 1234)
    expect(snapshot).toMatchObject({ iteration: 3, step: 3, loss: 0.2, timestamp: 1234 })
  })

  it('按时间顺序去重并限制关键快照数量', () => {
    const snapshots = [0, 1, 2, 3, 4].map(iteration => ({ iteration, loss: 1 - iteration / 10 }))
    expect(selectKeySnapshots(snapshots, 3).map(snapshot => snapshot.iteration)).toEqual([0, 2, 4])
  })
})

describe('训练控制状态', () => {
  it('支持开始、暂停、单步、继续、停止和重置', () => {
    let state: TrainingControlState = { status: 'idle', step: 0 }
    const events: TrainingControlEvent[] = ['start', 'pause', 'step', 'resume', 'stop', 'reset']
    for (const event of events) state = transitionTrainingState(state, event)
    expect(state).toEqual({ status: 'idle', step: 0 })
    expect(transitionTrainingState({ status: 'paused', step: 2 }, 'step')).toEqual({ status: 'paused', step: 3 })
  })

  it('客户端可向活动 Worker 发送控制命令', () => {
    const worker: WorkerLike & { messages: unknown[] } = {
      onmessage: null,
      onerror: null,
      messages: [],
      postMessage(message) { this.messages.push(message) },
      terminate() {},
    }
    const client = createTrainInWorkerClient(() => worker)
    client.sendControl('pause')
    expect(worker.messages).toEqual([])
    void client.trainInWorker({ kind: 'knn', samples: [[0]], labels: ['a'], k: 1 })
    client.sendControl('pause')
    expect(worker.messages.at(-1)).toEqual({ type: 'pause' })
  })
})

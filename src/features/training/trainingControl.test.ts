import { describe, expect, it } from 'vitest'
import { createLogisticRegressionTrainer } from './logisticRegression'
import { createLinearSvmTrainer } from './linearSvm'
import { createMlpTrainer } from './mlp'
import { createVisualCnnTrainer } from './visualCnn'
import { defaultVisualLayers } from './visualNetwork'
describe('迭代控制检查点', () => {
  for (const trainer of [createLogisticRegressionTrainer(), createLinearSvmTrainer(), createMlpTrainer(), createVisualCnnTrainer()]) {
    it('每次迭代等待控制检查点，且单步输出一个快照', async () => {
      let checkpoints = 0
      const snapshots: number[] = []
      await trainer.train({ samples: Array.from({length: 4}, (_, i) => Array(64).fill(i % 2)), labels: [0, 1, 0, 1], iterations: 3, epochs: 3, imageShape: {width: 8, height: 8, channels: 1}, layers: defaultVisualLayers(), hiddenLayers: [2] } as never,
        snapshot => snapshots.push(snapshot.iteration), { checkpoint: async () => { checkpoints++ } })
      expect(checkpoints).toBe(3)
      expect(snapshots).toEqual([1, 2, 3])
    })
  }
})

import { createTrainingControl } from './trainingControl'
it('暂停阻止推进，单步只放行一次检查点，继续恢复', async () => {
  const states: boolean[] = []
  const control = createTrainingControl(value => states.push(value))
  control.send('pause')
  let count = 0
  const loop = (async () => { for (let i = 0; i < 3; i++) { await control.checkpoint(); count++ } })()
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(count).toBe(0)
  expect(states).toContain(true)
  control.send('step')
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(count).toBe(1)
  control.send('resume')
  await loop
  expect(count).toBe(3)
})

import type { TrainingControl } from './types'
import type { WorkerControl } from './workerClient'
import type { ModelKind } from '../../app/workbenchTypes'
export const supportsTrainingControl = (kind?: ModelKind) => Boolean(kind && ['logistic-regression', 'linear-svm', 'mlp', 'visual-cnn', 'lstm', 'transformer', 'linear-regression', 'ridge-regression'].includes(kind))
export function createTrainingControl(onState: (paused: boolean) => void = () => {}, onStep: () => void = () => {}): TrainingControl & { send(command: WorkerControl | 'cancel'): void } {
  let paused = false
  let cancelled = false
  let steps = 0
  let wake: (() => void) | undefined
  let announced = false
  const yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0))
  return {
    send(command) {
      if (command === 'pause') paused = true
      if (command === 'resume') { paused = false; steps = 0; announced = false; onState(false) }
      if (command === 'step' && paused) steps++
      if (command === 'stop' || command === 'cancel') cancelled = true
      wake?.()
    },
    yield: yieldTask,
    async checkpoint() {
      await yieldTask()
      while (paused && steps === 0 && !cancelled) {
        if (!announced) { announced = true; onState(true) }
        await new Promise<void>(resolve => { wake = resolve })
      }
      wake = undefined
      if (cancelled) throw new DOMException('训练已取消', 'AbortError')
      if (paused) { steps--; onStep() }
    },
  }
}

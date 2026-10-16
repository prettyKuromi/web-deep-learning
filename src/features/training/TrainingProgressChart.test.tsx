import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TrainSnapshot } from './types'
import { TrainingProgressChart } from './TrainingProgressChart'

describe('TrainingProgressChart', () => {
  afterEach(() => cleanup())

  it.each([
    ['训练中…', '正在训练，等待过程数据'],
    ['训练已暂停', '训练已暂停'],
    ['训练已停止', '训练已停止'],
    ['训练完成', '已完成拟合'],
  ])('无损失快照在 %s 时展示真实状态', (status, message) => {
    render(<TrainingProgressChart snapshots={[{ iteration: 0 }]} status={status} />)
    expect(screen.getByText(message)).toBeInTheDocument()
    if (status !== '训练完成') expect(screen.queryByText('已完成拟合')).not.toBeInTheDocument()
  })

  it('在没有训练快照时显示空状态', () => {
    render(<TrainingProgressChart snapshots={[]} />)

    expect(screen.getByText('暂无训练过程数据')).toBeInTheDocument()
  })

  it('绘制损失曲线并标注迭代与损失坐标', () => {
    const snapshots: TrainSnapshot[] = [
      { iteration: 1, loss: 2 },
      { iteration: 2, loss: 1.2 },
      { iteration: 3, loss: 0.8 },
    ]

    render(<TrainingProgressChart snapshots={snapshots} />)

    expect(screen.getByRole('img', { name: '训练损失曲线' })).toBeInTheDocument()
    expect(screen.getByText('迭代')).toBeInTheDocument()
    expect(screen.getByText('损失')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(document.querySelector('polyline')).toBeTruthy()
  })

  it('忽略缺失或无效损失值，避免曲线出现异常点', () => {
    const snapshots: TrainSnapshot[] = [
      { iteration: 1 },
      { iteration: 2, loss: Number.NaN },
      { iteration: 3, loss: 0.5 },
    ]

    render(<TrainingProgressChart snapshots={snapshots} />)

    expect(screen.getByRole('img', { name: '训练损失曲线' })).toBeInTheDocument()
    expect(document.querySelector('polyline')).toBeTruthy()
  })
})

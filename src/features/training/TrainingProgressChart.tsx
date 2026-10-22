import type { TrainSnapshot } from './types'
import type { ReactNode } from 'react'

export interface TrainingProgressChartProps {
  snapshots: readonly TrainSnapshot[]
  status?: string
  fallback?: ReactNode
  width?: number
  height?: number
}

const margin = { top: 20, right: 20, bottom: 42, left: 52 }

export function TrainingProgressChart({ snapshots, status, fallback, width = 640, height = 280 }: TrainingProgressChartProps) {
  const points = snapshots
    .filter((snapshot) => Number.isFinite(snapshot.loss) && Number.isFinite(snapshot.iteration))
    .map((snapshot) => ({ iteration: snapshot.iteration, loss: snapshot.loss as number }))

  if (points.length === 0) {
    const message = status === '训练完成' ? '已完成拟合'
      : status === '训练中…' ? '正在训练，等待过程数据'
      : status === '训练已暂停' || status === '训练已停止' || status === '训练已取消' || status === '训练失败' ? status
      : '暂无训练过程数据'
    const description = status === '训练完成' ? '本次训练未记录迭代损失，可查看模型说明和评估结果。'
      : status === '训练中…' ? '收到可绘制的损失值后会更新曲线。'
      : status === '训练已暂停' ? '继续训练或单步执行，观察后续变化。'
      : status === '训练已停止' || status === '训练已取消' || status === '训练失败' ? '可调整参数后重新开始训练。'
      : '开始训练后，这里会显示损失变化。'
    return (
      <div role="img" aria-label="训练损失曲线" className={fallback ? 'training-chart-empty training-chart-empty--with-fallback' : 'training-chart-empty'}>
        {fallback ? <><strong>当前数据投影</strong>{fallback}<span>{description}</span></> : <><strong>{message}</strong><span>{description}</span></>}
      </div>
    )
  }

  const plotWidth = Math.max(1, width - margin.left - margin.right)
  const plotHeight = Math.max(1, height - margin.top - margin.bottom)
  const minIteration = Math.min(...points.map((point) => point.iteration))
  const maxIteration = Math.max(...points.map((point) => point.iteration))
  const minLoss = Math.min(0, ...points.map((point) => point.loss))
  const maxLoss = Math.max(...points.map((point) => point.loss))
  const iterationSpan = maxIteration - minIteration || 1
  const lossSpan = maxLoss - minLoss || 1
  const x = (iteration: number) => margin.left + ((iteration - minIteration) / iterationSpan) * plotWidth
  const y = (loss: number) => margin.top + (1 - (loss - minLoss) / lossSpan) * plotHeight
  const polyline = points.map((point) => `${x(point.iteration)},${y(point.loss)}`).join(' ')
  const yTicks = [maxLoss, minLoss + lossSpan / 2, minLoss]
  const xTicks = minIteration === maxIteration ? [minIteration] : [minIteration, maxIteration]

  return (
    <div className="training-chart-wrapper">
      <p className="training-chart-title">训练损失趋势</p>
      <svg
      role="img"
      aria-label="训练损失曲线"
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', display: 'block', background: '#0a192d', borderRadius: 12 }}
    >
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#94a3b8" />
      <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#94a3b8" />
      {yTicks.map((tick, index) => (
        <g key={`y-${index}`}>
          <line x1={margin.left} y1={y(tick)} x2={width - margin.right} y2={y(tick)} stroke="#263951" />
          <text x={margin.left - 8} y={y(tick) + 4} textAnchor="end" fill="#a6b8d1" fontSize="12">
            {tick.toFixed(2)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <text key={tick} x={x(tick)} y={height - margin.bottom + 22} textAnchor="middle" fill="#a6b8d1" fontSize="12">
          {tick}
        </text>
      ))}
      <text x={width / 2} y={height - 8} textAnchor="middle" fill="#a6b8d1" fontSize="12">迭代</text>
      <text x={14} y={height / 2} textAnchor="middle" fill="#a6b8d1" fontSize="12" transform={`rotate(-90 14 ${height / 2})`}>损失</text>
      <polyline points={polyline} fill="none" stroke="#58ddff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => (
        <circle key={`${point.iteration}-${point.loss}`} cx={x(point.iteration)} cy={y(point.loss)} r="3.5" fill="#58ddff">
          <title>第 {point.iteration} 次迭代，损失 {point.loss.toFixed(4)}</title>
        </circle>
      ))}
      </svg>
      <p className="training-chart-caption">横轴：迭代次数　纵轴：损失值　蓝线：Worker 实际快照</p>
    </div>
  )
}

import type { TrainSnapshot } from './types'

export interface TrainingProgressChartProps {
  snapshots: readonly TrainSnapshot[]
  width?: number
  height?: number
}

const margin = { top: 20, right: 20, bottom: 42, left: 52 }

export function TrainingProgressChart({ snapshots, width = 640, height = 280 }: TrainingProgressChartProps) {
  const points = snapshots
    .filter((snapshot) => Number.isFinite(snapshot.loss) && Number.isFinite(snapshot.iteration))
    .map((snapshot) => ({ iteration: snapshot.iteration, loss: snapshot.loss as number }))

  if (points.length === 0) {
    return (
      <div role="img" aria-label="训练损失曲线" style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
        暂无训练过程数据
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
    <svg
      role="img"
      aria-label="训练损失曲线"
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', display: 'block', background: '#f8fafc', borderRadius: 12 }}
    >
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#94a3b8" />
      <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#94a3b8" />
      {yTicks.map((tick, index) => (
        <g key={`y-${index}`}>
          <line x1={margin.left} y1={y(tick)} x2={width - margin.right} y2={y(tick)} stroke="#e2e8f0" />
          <text x={margin.left - 8} y={y(tick) + 4} textAnchor="end" fill="#64748b" fontSize="12">
            {tick.toFixed(2)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <text key={tick} x={x(tick)} y={height - margin.bottom + 22} textAnchor="middle" fill="#64748b" fontSize="12">
          {tick}
        </text>
      ))}
      <text x={width / 2} y={height - 8} textAnchor="middle" fill="#475569" fontSize="12">迭代</text>
      <text x={14} y={height / 2} textAnchor="middle" fill="#475569" fontSize="12" transform={`rotate(-90 14 ${height / 2})`}>损失</text>
      <polyline points={polyline} fill="none" stroke="#355cde" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => (
        <circle key={`${point.iteration}-${point.loss}`} cx={x(point.iteration)} cy={y(point.loss)} r="3.5" fill="#355cde">
          <title>第 {point.iteration} 次迭代，损失 {point.loss.toFixed(4)}</title>
        </circle>
      ))}
    </svg>
  )
}

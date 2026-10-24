import { useEffect, useId, useRef } from 'react'
import { buildScatterPlotData, createDecisionBoundaryGrid, normalizePoint, type PlotFeature, type PlotLabel } from './plotData'

export interface DecisionBoundaryChartProps {
  features: readonly PlotFeature[]
  labels: readonly PlotLabel[]
  predictions?: readonly PlotLabel[]
  predict?: (point: PlotFeature) => PlotLabel
  width?: number
  height?: number
  resolution?: number
}

const palette = ['#355cde', '#ef8354', '#35a06f', '#9b5de5', '#f2c14e', '#16a6a6']

export function DecisionBoundaryChart({
  features,
  labels,
  predictions,
  predict,
  width = 640,
  height = 420,
  resolution = 60,
}: DecisionBoundaryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const descriptionId = useId()
  const classCounts = new Map<PlotLabel, number>()
  labels.forEach((label) => classCounts.set(label, (classCounts.get(label) ?? 0) + 1))
  const distribution = [...classCounts].map(([label, count]) => `${typeof label === 'string' ? `“${label}”` : label} ${count} 个`).join('，') || '无'
  const description = `样本数：${features.length}。类别数：${classCounts.size}。类别分布：${distribution}。二维投影：横轴为特征 1，纵轴为特征 2。`

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || features.length === 0) return
    const context = canvas.getContext('2d')
    if (!context) return
    const data = buildScatterPlotData(features, labels, predictions)
    const grid = predict ? createDecisionBoundaryGrid(features, predict, { bounds: data.bounds, resolution }) : undefined
    const scaleX = (value: number) => value * width
    const scaleY = (value: number) => value * height
    context.clearRect(0, 0, width, height)

    const classes = [...new Set([...labels, ...(predictions ?? [])])]
    if (grid) {
      const cellWidth = width / grid.resolution
      const cellHeight = height / grid.resolution
      grid.cells.forEach((cell, index) => {
        const column = index % grid.resolution
        const row = Math.floor(index / grid.resolution)
        const classIndex = Math.max(0, classes.indexOf(cell.label))
        context.fillStyle = `${palette[classIndex % palette.length]}20`
        context.fillRect(column * cellWidth, row * cellHeight, cellWidth + 1, cellHeight + 1)
      })
    }

    data.points.forEach((point) => {
      const normalized = normalizePoint([point.x, point.y], data.bounds)
      context.beginPath()
      context.arc(scaleX(normalized.x), scaleY(normalized.y), point.correct === false ? 6 : 5, 0, Math.PI * 2)
      context.fillStyle = palette[Math.max(0, classes.indexOf(point.label)) % palette.length]
      context.fill()
      if (point.correct === false) {
        context.strokeStyle = '#b42318'
        context.lineWidth = 2
        context.stroke()
      }
    })
  }, [features, labels, predictions, predict, width, height, resolution])

  return (
    <div className="scatter-chart">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        role="img"
        aria-label={predict ? '二维数据散点图与决策边界' : '二维数据散点图'}
        aria-describedby={descriptionId}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, background: '#f8fafc' }}
      />
      <div className="scatter-legend" aria-label="类别图例">
        {[...new Set(labels)].map((label, index) => <span key={`${typeof label}:${String(label)}`}>
          <i aria-hidden="true" style={{ background: palette[index % palette.length] }} />{String(label)}
        </span>)}
      </div>
      <p id={descriptionId} className="scatter-chart-summary" style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '.74rem', lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  )
}

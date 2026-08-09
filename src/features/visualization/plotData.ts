export type PlotFeature = readonly number[]
export type PlotLabel = string | number

export interface PlotBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ScatterPoint {
  x: number
  y: number
  label: PlotLabel
  prediction?: PlotLabel
  correct?: boolean
}

export interface ScatterPlotData {
  points: ScatterPoint[]
  bounds: PlotBounds
}

export interface BoundaryCell {
  x: number
  y: number
  label: PlotLabel
}

export interface DecisionBoundaryGrid {
  bounds: PlotBounds
  resolution: number
  cells: BoundaryCell[]
}

export function getPlotBounds(features: readonly PlotFeature[], paddingRatio = 0.08): PlotBounds {
  if (features.length === 0) throw new Error('features cannot be empty')
  const xs = features.map((feature) => feature[0])
  const ys = features.map((feature) => feature[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  return {
    minX: minX - rangeX * paddingRatio,
    maxX: maxX + rangeX * paddingRatio,
    minY: minY - rangeY * paddingRatio,
    maxY: maxY + rangeY * paddingRatio,
  }
}

export function normalizePoint(feature: PlotFeature, bounds: PlotBounds): { x: number; y: number } {
  const [x, y] = feature
  return {
    x: (x - bounds.minX) / (bounds.maxX - bounds.minX),
    y: 1 - (y - bounds.minY) / (bounds.maxY - bounds.minY),
  }
}

export function buildScatterPlotData(
  features: readonly PlotFeature[],
  labels: readonly PlotLabel[],
  predictions?: readonly PlotLabel[],
): ScatterPlotData {
  if (features.length !== labels.length) throw new Error('features and labels length must match')
  if (predictions && predictions.length !== features.length) throw new Error('predictions length must match features')
  const bounds = getPlotBounds(features)
  return {
    bounds,
    points: features.map((feature, index) => ({
      x: feature[0],
      y: feature[1],
      label: labels[index],
      prediction: predictions?.[index],
      correct: predictions ? predictions[index] === labels[index] : undefined,
    })),
  }
}

export function createDecisionBoundaryGrid(
  features: readonly PlotFeature[],
  predict: (point: PlotFeature) => PlotLabel,
  options: { resolution?: number; bounds?: PlotBounds } = {},
): DecisionBoundaryGrid {
  const resolution = Math.max(2, Math.floor(options.resolution ?? 60))
  const bounds = options.bounds ?? getPlotBounds(features)
  const cells: BoundaryCell[] = []
  for (let row = 0; row < resolution; row += 1) {
    const y = bounds.maxY - (row / (resolution - 1)) * (bounds.maxY - bounds.minY)
    for (let column = 0; column < resolution; column += 1) {
      const x = bounds.minX + (column / (resolution - 1)) * (bounds.maxX - bounds.minX)
      cells.push({ x, y, label: predict([x, y]) })
    }
  }
  return { bounds, resolution, cells }
}

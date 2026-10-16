import { modelTask, type ExperimentRecord } from '../../app/workbenchTypes'
import { CurrentResultPanel } from './CurrentResultPanel'
import { PcaResultPanel } from './UnsupervisedResultPanel'
import { DecisionBoundaryChart } from '../visualization/DecisionBoundaryChart'
import type { Label, Labels, PcaModel } from '../training/types'
export function regressionMetrics(actual: readonly number[], predicted: readonly number[]) {
  const mean = actual.reduce((sum, value) => sum + value, 0) / actual.length
  const residual = actual.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0)
  const variance = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0)
  return { mae: actual.reduce((sum, value, index) => sum + Math.abs(value - predicted[index]), 0) / actual.length, mse: residual / actual.length, r2: variance === 0 ? (residual === 0 ? 1 : 0) : 1 - residual / variance }
}
export function experimentSummary(record: ExperimentRecord): string {
  const task = modelTask[record.modelKind]
  if (task === 'classification') return '训练集准确率 ' + ((record.metrics?.accuracy ?? 0) * 100).toFixed(1) + '%'
  if (task === 'regression') return '训练集 MAE ' + regressionMetrics(record.dataset.labels as number[], record.predictions as number[]).mae.toFixed(4)
  if (task === 'clustering') return '簇数 ' + new Set((record.predictions as number[]).filter(value => value >= 0)).size + ' · 噪声 ' + (record.predictions as number[]).filter(value => value < 0).length
  const model = record.model as PcaModel
  return '累计方差解释率 ' + ((model?.explainedVariance ?? []).reduce((sum, value) => sum + value, 0) * 100).toFixed(1) + '%'
}
export function ExperimentResultPanel({ record, predict }: { record: ExperimentRecord; predict?: (point: readonly number[]) => Label }) {
  const task = modelTask[record.modelKind]
  if (task === 'classification' && record.metrics) return <CurrentResultPanel result={{ dataset: record.dataset, metrics: record.metrics, predictions: record.predictions as Labels, predict }} />
  if (task === 'dimensionality-reduction') return <PcaResultPanel model={record.model as PcaModel} projections={record.predictions as readonly (readonly number[])[]} />
  const predictions = record.predictions as number[]
  return <section className="workbench-page-card current-result current-result--padded" aria-label="当前结果"><h3>{task === 'regression' ? '回归结果' : '聚类结果'}</h3>
    {task === 'regression' ? <><div className="metric-grid">{Object.entries(regressionMetrics(record.dataset.labels as number[], predictions)).map(([key, value]) => <div key={key}><strong>{value.toFixed(4)}</strong><span>{key === 'mae' ? '平均绝对误差（MAE）' : key === 'mse' ? '均方误差（MSE）' : '决定系数（R²）'}</span></div>)}</div><p className="detail-explanation">以上为训练集误差，不能代表泛化能力；R² 在预测较差时可以为负数。</p><div className="matrix-wrap"><table><thead><tr><th>样本</th><th>真实值</th><th>预测值</th></tr></thead><tbody>{predictions.slice(0, 8).map((value, index) => <tr key={index}><td>{index + 1}</td><td>{Number(record.dataset.labels[index]).toFixed(4)}</td><td>{value.toFixed(4)}</td></tr>)}</tbody></table></div></> : <><div className="metric-grid">{[...new Set(predictions)].sort((a, b) => a - b).map(cluster => <div key={cluster}><strong>{predictions.filter(value => value === cluster).length}</strong><span>{cluster < 0 ? '噪声样本' : '簇 ' + (cluster + 1)}</span></div>)}</div><p className="detail-explanation">按模型分簇着色；噪声标签为 -1。散点展示前两个特征的投影。</p>{record.dataset.features[0]?.length >= 2 && <DecisionBoundaryChart features={record.dataset.features} labels={predictions.map(value => value < 0 ? '噪声' : '簇 ' + (value + 1))} />}</>}
  </section>
}

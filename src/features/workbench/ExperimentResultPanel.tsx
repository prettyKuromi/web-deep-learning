import { modelTask, type ExperimentRecord } from '../../app/workbenchTypes'
import { regressionMetrics } from './resultUtils'
import { CurrentResultPanel } from './CurrentResultPanel'
import { PcaResultPanel } from './UnsupervisedResultPanel'
import { DecisionBoundaryChart } from '../visualization/DecisionBoundaryChart'
import type { Label, Labels, PcaModel } from '../training/types'
import { PredictionPlayground } from './PredictionPlayground'
export function ExperimentResultPanel({ record, predict }: { record: ExperimentRecord; predict?: (point: readonly number[]) => Label }) {
  const task = modelTask[record.modelKind]
  if (task === 'classification' && record.metrics) return <CurrentResultPanel result={{ dataset: record.dataset, metrics: record.metrics, predictions: record.predictions as Labels, predict, evaluation: record.evaluation && { trainSampleCount: record.evaluation.trainSampleCount, validationSampleCount: record.evaluation.validationSampleCount, validationMetrics: record.evaluation.validationMetrics as import('../training/types').ClassificationMetrics | undefined } }} />
  if (task === 'dimensionality-reduction') return <PcaResultPanel model={record.model as PcaModel} projections={record.predictions as readonly (readonly number[])[]} />
  const predictions = record.predictions as number[]
  const evaluation = record.evaluation?.config.enabled ? record.evaluation : undefined
  const trainMetrics = evaluation
    ? evaluation.trainMetrics && 'mae' in evaluation.trainMetrics ? evaluation.trainMetrics : undefined
    : regressionMetrics(record.dataset.labels as number[], predictions)
  return <section className="workbench-page-card current-result current-result--padded" aria-label="当前结果"><h3>{task === 'regression' ? '回归结果' : '聚类结果'}</h3>
    {task === 'regression' ? <>{trainMetrics ? <><h4>训练集指标</h4><div className="metric-grid">{Object.entries(trainMetrics).map(([key, value]) => <div key={key}><strong>{value.toFixed(4)}</strong><span>{key === 'mae' ? '平均绝对误差（MAE）' : key === 'mse' ? '均方误差（MSE）' : '决定系数（R²）'}</span></div>)}</div><p className="detail-explanation">以上为训练集误差，不能代表泛化能力；R² 在预测较差时可以为负数。</p></> : <p className="detail-explanation">训练集指标未记录</p>}{evaluation && <section className="evaluation-summary" aria-label="训练与验证集评估"><h4>数据评估来源</h4><p>训练集：{evaluation.trainSampleCount} 条；验证集：{evaluation.validationSampleCount} 条。</p>{evaluation.validationMetrics && 'mae' in evaluation.validationMetrics && <p>验证集 MAE {evaluation.validationMetrics.mae.toFixed(4)} · MSE {evaluation.validationMetrics.mse.toFixed(4)} · R² {evaluation.validationMetrics.r2.toFixed(4)}</p>}</section>}<div className="matrix-wrap"><table><caption>{evaluation ? '全量数据预测样例（包含训练集与验证集）' : '全量训练数据预测样例'}</caption><thead><tr><th>样本</th><th>真实值</th><th>预测值</th></tr></thead><tbody>{predictions.slice(0, 8).map((value, index) => <tr key={index}><td>{index + 1}</td><td>{Number(record.dataset.labels[index]).toFixed(4)}</td><td>{value.toFixed(4)}</td></tr>)}</tbody></table></div>{predict && <PredictionPlayground dataset={record.dataset} predict={predict} task="regression" />}</> : <><div className="metric-grid">{[...new Set(predictions)].sort((a, b) => a - b).map(cluster => <div key={cluster}><strong>{predictions.filter(value => value === cluster).length}</strong><span>{cluster < 0 ? '噪声样本' : '簇 ' + (cluster + 1)}</span></div>)}</div><p className="detail-explanation">按模型分簇着色；噪声标签为 -1。散点展示前两个特征的投影。</p>{record.dataset.features[0]?.length >= 2 && <DecisionBoundaryChart features={record.dataset.features} labels={predictions.map(value => value < 0 ? '噪声' : '簇 ' + (value + 1))} />}</>}
  </section>
}

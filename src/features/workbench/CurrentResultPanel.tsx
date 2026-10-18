import type { Dataset } from '../datasets/dataset'
import { DecisionBoundaryChart } from '../visualization/DecisionBoundaryChart'
import type { ClassificationMetrics, Label } from '../training/types'
import { PredictionPlayground } from './PredictionPlayground'

export interface CurrentResult {
  dataset: Dataset
  predictions: readonly Label[]
  metrics: ClassificationMetrics
  predict?: (point: readonly number[]) => Label
  evaluation?: { trainSampleCount: number; validationSampleCount: number; validationMetrics?: ClassificationMetrics }
}

export function CurrentResultPanel({ result }: { result: CurrentResult }) {
  const { metrics, dataset, predictions, predict, evaluation } = result
  return (
    <section className="workbench-page-card current-result current-result--padded" aria-labelledby="current-result-title">
      <h3 id="current-result-title">当前结果</h3>
      <div className="metric-grid">
        {([['准确率', metrics.accuracy], ['精确率', metrics.precision], ['召回率', metrics.recall], ['F1', metrics.f1]] as const).map(([label, value]) => (
          <div key={label}><strong>{(value * 100).toFixed(1)}%</strong><span>{label}</span></div>
        ))}
      </div>
      <p className="detail-explanation">训练集指标，不能代表泛化能力。精确率、召回率与 F1 为各类别宏平均。</p>
      {evaluation && <section className="evaluation-summary" aria-label="训练与验证集评估"><h4>数据评估来源</h4><p>训练集：{evaluation.trainSampleCount} 条；验证集：{evaluation.validationSampleCount} 条。</p>{evaluation.validationMetrics ? <p>验证集准确率 {(evaluation.validationMetrics.accuracy * 100).toFixed(1)}% · F1 {(evaluation.validationMetrics.f1 * 100).toFixed(1)}%</p> : <p>验证集指标暂不可用。</p>}</section>}
      <div className="matrix-wrap">
        <h4>混淆矩阵</h4>
        <p>行是真实类别，列是预测类别。</p><table><thead><tr><th scope="col">真实 / 预测</th>{metrics.labels.map(label => <th scope="col" key={String(label)}>{label}</th>)}</tr></thead><tbody>{metrics.confusionMatrix.map((row, index) => <tr key={index}><th scope="row">{metrics.labels[index]}</th>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table>
      </div>
      {dataset.dataType !== 'image' && dataset.features.length > 0 && (
        <div className="chart-frame">
          {dataset.features[0]?.length >= 2 && <DecisionBoundaryChart features={dataset.features.map(([x, y]) => [x, y] as const)} labels={dataset.labels} predictions={predictions} predict={dataset.features[0]?.length === 2 ? predict : undefined} />}
          {dataset.features[0]?.length > 2 && <p className="projection-notice">当前图表仅展示前两个特征的投影，不代表真实的高维决策边界。</p>}
        </div>
      )}
      {predict && dataset.features.length > 0 && <PredictionPlayground dataset={dataset} predict={predict} task="classification" />}
    </section>
  )
}

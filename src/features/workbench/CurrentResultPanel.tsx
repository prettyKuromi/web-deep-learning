import type { Dataset } from '../datasets/dataset'
import { DecisionBoundaryChart } from '../visualization/DecisionBoundaryChart'
import type { ClassificationMetrics, Label } from '../training/types'

export interface CurrentResult {
  dataset: Dataset
  predictions: readonly Label[]
  metrics: ClassificationMetrics
  predict?: (point: readonly number[]) => Label
}

export function CurrentResultPanel({ result }: { result: CurrentResult }) {
  const { metrics, dataset, predictions, predict } = result
  return (
    <section className="workbench-page-card current-result current-result--padded" aria-labelledby="current-result-title">
      <h3 id="current-result-title">当前结果</h3>
      <div className="metric-grid">
        {([['准确率', metrics.accuracy], ['Precision', metrics.precision], ['Recall', metrics.recall], ['F1', metrics.f1]] as const).map(([label, value]) => (
          <div key={label}><strong>{(value * 100).toFixed(1)}%</strong><span>{label}</span></div>
        ))}
      </div>
      <div className="matrix-wrap">
        <h4>混淆矩阵</h4>
        <table><tbody>{metrics.confusionMatrix.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table>
      </div>
      {predict && dataset.features.length > 0 && (
        <div className="chart-frame">
          {dataset.features[0]?.length >= 2 && <DecisionBoundaryChart features={dataset.features.map(([x, y]) => [x, y] as const)} labels={dataset.labels} predictions={predictions} predict={predict} />}
          {dataset.features[0]?.length > 2 && <p className="projection-notice">当前图表仅展示前两个特征的投影，不代表真实的高维决策边界。</p>}
        </div>
      )}
    </section>
  )
}

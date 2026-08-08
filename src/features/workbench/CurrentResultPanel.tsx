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
    <section className="workbench-page-card current-result" aria-labelledby="current-result-title">
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
        <div className="chart-frame"><DecisionBoundaryChart features={dataset.features} labels={dataset.labels} predictions={predictions} predict={predict} /></div>
      )}
    </section>
  )
}

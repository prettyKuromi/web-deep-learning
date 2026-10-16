import { DecisionBoundaryChart } from '../visualization/DecisionBoundaryChart'
import type { PcaModel } from '../training/types'

export function PcaResultPanel({ model, projections }: { model: PcaModel; projections: readonly (readonly number[])[] }) {
  return <section className="workbench-page-card current-result" aria-labelledby="pca-result-title">
    <h3 id="pca-result-title">PCA 降维结果</h3>
    <div className="metric-grid">{model.explainedVariance.map((ratio, index) => <div key={index}><strong>{(ratio * 100).toFixed(1)}%</strong><span>主成分 {index + 1} 方差解释率</span></div>)}</div>
    <p className="detail-explanation">累计解释率：{(model.explainedVariance.reduce((sum, ratio) => sum + ratio, 0) * 100).toFixed(1)}%。下表展示前 8 条样本在主成分空间的投影。</p>
    <p className="detail-explanation">主成分方向：{model.components.map((row, index) => `PC${index + 1} = [${row.map(value => value.toFixed(3)).join(", ")}]`).join("；")}</p>
    {model.components.length >= 2 && <DecisionBoundaryChart features={projections} labels={projections.map(() => "样本投影")} />}
    <div className="matrix-wrap"><table><thead><tr><th>样本</th>{model.components.map((_, index) => <th key={index}>PC{index + 1}</th>)}</tr></thead><tbody>{projections.slice(0, 8).map((row, index) => <tr key={index}><td>{index + 1}</td>{row.map((value, component) => <td key={component}>{value.toFixed(4)}</td>)}</tr>)}</tbody></table></div>
  </section>
}

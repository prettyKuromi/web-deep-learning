# SDD-006：二维分类可视化

- 状态：已实现
- 版本：1.1
- 适用阶段：MVP

## 1. 背景与目标

为训练结果提供轻量的二维散点图和决策边界展示。可视化模块只依赖通用的二维特征、标签及预测函数，能够嵌入工作台而不耦合具体模型或状态管理。

## 2. 范围

- 绘制二维样本散点，按类别着色。
- 可选绘制预测错误点。
- 根据 `predict(point)` 在有界网格上生成决策边界背景。
- 为 Canvas 图表提供屏幕阅读器可读取的文本摘要，说明样本数、类别数量与分布，以及横纵轴对应的特征投影。
- 提供纯函数构建绘图数据、计算边界和网格，便于测试。
- 第一版使用 Canvas，避免引入额外图表组件状态；训练曲线和混淆矩阵可在后续 SDD 中补充。

## 3. 数据与 API

```ts
type PlotFeature = readonly [number, number]
type PlotLabel = string | number

buildScatterPlotData(features, labels, predictions?)
getPlotBounds(features, paddingRatio?)
createDecisionBoundaryGrid(features, predict, { resolution?, bounds? })

<DecisionBoundaryChart
  features={features}
  labels={labels}
  predictions={predictions}
  predict={modelPredict}
/>
```

组件通过 `aria-describedby` 关联唯一的摘要文本。摘要显示在图表下方，不改变 Canvas 的绘制尺寸。

边界默认在数据极值外扩 8%；网格默认 60×60，最小分辨率为 2。预测长度与样本长度不一致时抛出可读错误。

## 4. 用户流程

1. 工作台将当前二维数据传入组件。
2. 若训练器提供预测函数，组件先生成网格并绘制半透明类别背景。
3. 组件在背景上绘制样本点；预测错误点使用红色描边强调。
4. 数据或预测函数变化时重绘 Canvas。
5. 屏幕阅读器用户聚焦图表时能读取样本总数、各标签样本数及横纵轴对应的特征投影。

## 5. 验收标准

- 相同输入得到确定性的边界和网格。
- 空数据、长度不一致数据能快速失败并返回明确错误。
- 支持字符串和数字标签。
- 默认 60×60 网格可以在常规浏览器中完成绘制；组件不阻塞训练逻辑。
- 无预测函数时仍能显示散点图。
- 图表具有稳定的可访问名称，并通过 `aria-describedby` 关联包含样本数、类别数/分布和特征投影的摘要。

## 6. 测试策略与验证记录

- `src/features/visualization/plotData.test.ts` 覆盖边界计算、点归一化、散点数据构建、预测长度校验和网格预测。
- `src/features/visualization/DecisionBoundaryChart.test.tsx` 覆盖图表摘要内容、动态更新、标签类型区分、可访问名称及 `aria-describedby` 关联。
- 验证命令：`npm test -- --run src/features/visualization`（4 个测试文件、21 项通过）。
- 实现状态：图表现在按实际内容提供可访问名称，并关联可见文本摘要；摘要展示样本数、类别数和类别分布，以及特征 1/2 的投影说明。

## 7. 已知限制与后续

- 当前未提供坐标轴、图例和缩放交互；工作台可在后续接入 ECharts 或补充 Canvas overlay。
- 当前摘要统一将横轴和纵轴称为“特征 1”和“特征 2”；调用方若使用高维数据投影，应在图表旁保留对应说明。
- 当前仅支持二维数值特征；高维数据投影由数据管理模块负责。
- 网格预测为同步调用，复杂模型接入时应由 Worker 预计算后传入。

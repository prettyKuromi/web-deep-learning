# SDD-028：统一训练集与验证集评估

## 背景与目标

当前工作台主要展示训练集指标，用户无法判断模型对未参与拟合数据的表现。为监督学习增加确定性的留出集评估，并在训练快照及最终结果中区分训练指标与验证指标。

## 范围

- 分类和回归任务支持固定随机种子的训练/验证划分。
- 分类采用分层抽样，保证可行时各类别在训练集和验证集都有样本。
- 训练器只接收训练子集；验证样本只用于评估，不泄漏到拟合过程。
- 快照和最终结果区分 train/validation loss 与 metrics，显示数据来源和样本数。
- 无法有效划分时显示中文原因，允许用户显式选择仅训练集评估。
- 聚类与降维算法暂不纳入监督验证指标。

## 用户流程

用户可启用验证集并设置比例和随机种子，启动训练后查看训练/验证趋势。完成时查看两组指标及各自样本量；无法划分时按提示调整比例或显式切换训练集评估。

## 技术方案

新增纯函数数据划分模块，输入数据、任务类型、验证比例和 seed，输出索引及划分摘要。对分类数据按类别分层后确定性洗牌；回归数据按确定性洗牌切分。训练编排只向 Trainer 传训练部分，按 Worker 快照对应模型状态预测验证集。每个快照最多评估一次完整验证集；如成本过高，按配置间隔评估并明确最近评估步。

## 数据结构/API

```ts
interface EvaluationConfig { enabled: boolean; validationSplit: number; seed: number }
interface EvaluationMetrics {
  train?: { sampleCount: number; loss?: number; metrics?: ClassificationMetrics; regression?: RegressionMetrics }
  validation?: { sampleCount: number; loss?: number; metrics?: ClassificationMetrics; regression?: RegressionMetrics }
  evaluatedAtStep: number
}
```

实验记录新增可选 `evaluation` 与 `split` 元数据；旧记录继续可读取。

## 验收标准

- 相同数据、比例和 seed 得到一致划分，不同 seed 可改变划分。
- 分类划分分层且训练集包含全部类别；极小数据集无法划分时提供可理解错误。
- 验证数据不参与 Trainer 拟合；训练曲线和最终结果标明数据来源及样本数。
- 分类展示 accuracy/precision/recall/F1/confusion matrix；回归展示 MAE/MSE/R²。
- 旧实验兼容，未启用验证集时现有训练流程可用。

## 测试策略

- Vitest 覆盖确定性、分层、极小类别、无泄漏及分类/回归指标。
- 组件测试确认数据来源、样本数及不可划分提示。
- Playwright 验证启用验证集后曲线和结果匹配训练配置。

## 未决问题

- 默认验证比例为 20%，默认 seed 复用实验随机种子；没有随机种子时使用固定默认值 42。
- MVP 不提供独立测试集或交叉验证，后续按用户需求增加。

## 实现状态

- 状态：划分与指标基础函数已实现；尚未接入训练编排、快照、结果页和历史记录，因此本功能整体仍未完成。
- 已实现：固定随机种子的分类分层/回归随机划分、训练与验证行选择、分类评估指标和回归 MAE/MSE/R² 指标；无法划分时提供中文错误。
- 验证命令：`npm test -- --run src/features/training/evaluation.test.ts`（5 项通过）；完整构建与 lint 待集成阶段复核。
- 已知限制：当前训练 Worker 和界面未使用这些函数，不能在产品中启用或声称提供验证集评估；分类单例类别保留在训练集，不进入验证集。

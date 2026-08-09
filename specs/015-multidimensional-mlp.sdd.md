# SDD-015：多维表格数据与多层感知机

- 状态：已批准，实施中
- 编号：015
- 创建日期：2026-08-09

## 1. 背景与目标

当前项目的数据输入和部分界面仍假设每个样本只有两个数值特征。为了从二维点分类实验升级为可扩展的浏览器端机器学习实验工作台，本功能支持任意维度的数值表格数据，并加入第一个深度学习模型：多层感知机（MLP）。二维数据仍保留决策边界可视化作为兼容特例。

## 2. 范围

### 包含

- 任意数量的数值特征（首期建议 1–128 维）和分类标签。
- CSV 任意数值列选择、标签列选择、非法行统计和中文错误提示。
- 二分类和多分类 MLP。
- 多隐藏层、ReLU/Tanh/Sigmoid、Softmax、Mini-batch SGD、固定随机种子。
- Web Worker 训练、训练快照、loss 与分类指标。
- 训练集/验证集划分；标准化只使用训练集统计量并保存到模型。
- 二维数据使用决策边界；高维数据使用 PCA 或特征对投影，并显示投影限制说明。
- 实验 JSON/IndexedDB 持久化和旧实验兼容。

### 不包含

- 图像/CNN、文本/RNN/Transformer、回归 MLP、自动类别特征编码、WebGPU。

## 3. 用户流程

用户选择内置数据集或上传 CSV，选择任意数值特征列和标签列，检查维度、缺失值和类别分布；随后选择 MLP 结构与训练参数，开始或取消 Worker 训练；训练过程中查看 loss/指标，完成后查看混淆矩阵和二维/PCA 投影，最后保存或导出实验。

## 4. 技术方案

- 将 Dataset 特征统一为 `number[][]`，二维 tuple 仅作为类型兼容别名。
- MLP 使用纯 TypeScript 实现前向传播、交叉熵、反向传播和 Mini-batch SGD。
- 使用确定性 PRNG 初始化权重和洗牌，禁止使用 `Math.random`。
- 训练器复用现有 `Trainer` 与 Worker 消息协议；模型权重和预处理参数可 JSON 序列化。
- 高维可视化不伪造真实决策边界：默认使用 PCA 前两维或用户选择的特征对，并显示“仅投影”提示。
- 提供适用性提醒：MLP 仅接受数值特征；样本过少、类别极不平衡、特征尺度差异大或高维投影时结果可能不稳定或被误读。

## 5. 数据结构与 API

```ts
interface Dataset {
  features: number[][]
  labels: Array<string | number>
  featureNames?: string[]
  labelName?: string
  name?: string
}

interface MlpTrainConfig {
  samples: number[][]
  labels: Array<string | number>
  hiddenLayers?: number[]
  activation?: 'relu' | 'tanh' | 'sigmoid'
  learningRate?: number
  epochs?: number
  batchSize?: number
  validationSplit?: number
  normalize?: boolean
  seed?: number
}
```

MLP 模型必须保存层结构、权重、偏置、标签顺序、随机种子及标准化统计量。训练快照至少包含 epoch、loss 和可用分类指标。

## 6. 错误处理

空数据、标签数量不一致、特征维度不一致、非有限数值、类别少于两类、非法超参数和 CSV 无有效行时阻止训练并显示中文错误。验证集无法形成有效类别覆盖时给出提示并回退为训练集指标。高维图表提示投影含义，不将其标记为真实决策边界。

## 7. 验收标准

- 四维及以上 CSV 可选择字段并完成 MLP 二分类/多分类训练。
- XOR 和简单多分类合成数据可收敛；相同数据、参数、seed 结果一致。
- 训练/验证 loss、Accuracy、F1、混淆矩阵可见。
- 二维决策边界、高维 PCA/特征对投影均可用且有适用性提醒。
- 取消训练后 Worker 停止，原有模型流程不回归。
- 实验 JSON 导入导出可恢复模型和预处理参数。

## 8. 测试策略

Vitest 覆盖数据校验、CSV 多列解析、激活函数与梯度、XOR/多分类收敛、seed 确定性、标准化无泄漏、序列化和 Worker 路由；Playwright 覆盖高维 CSV 到 MLP 结果流程。验证命令：`npm test`、`npm run build`、`npm run lint`。

## 9. 实现记录

- 实现状态：已实现首版
- 验证命令：`npm test -- --run`（17 个测试文件、95 个测试通过）；`npm run build`；`npm run lint`
- 已知限制：首期只支持数值表格分类；高维图表为投影，不显示真实高维边界。

## 10. 未决问题

- 默认验证集比例和分层抽样策略需在实现中依据现有数据规模确定。
- PCA 投影可复用现有实现，后续再评估是否迁移到 Worker。

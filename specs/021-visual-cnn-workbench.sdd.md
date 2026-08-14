# SDD-021：可视化卷积神经网络工作台

- 状态：已实现
- 编号：021
- 创建日期：2026-08-15

## 1. 背景与目标

现有 MLP 仅通过“隐藏层数量 + 统一神经元数”配置，不能体现神经网络逐层构建、卷积和池化的工作方式。新增一个独立的图像分类模型入口“可视化卷积神经网络”，让初学者使用 8×8 灰度数字（0–9）数据集，以顺序方式添加、调整、排序和删除网络层，并在浏览器端观察训练中的数据流和损失变化。

目标是提供可真实训练、可解释、可复现的轻量 CNN；不以模拟动画替代训练结果，也不将图像模型错误应用到二维散点或 CSV 表格数据。

## 2. 范围

### 包含

- 新增内置“8×8 数字图像（0–9）”十分类数据集；样本由固定数字字模结合确定性平移、笔画扰动和噪声生成，默认 500 条，特征为 64 个归一化灰度值。
- 数据集标记为 `image`，包含 `imageShape: { width: 8, height: 8, channels: 1 }`；现有内置数据集和 CSV 标记为 `tabular`。
- 新模型 `visual-cnn`，仅可用于 `image` 数据集；现有 MLP 及其他模型仅可用于 `tabular` 数据集。
- 数据集说明展示适用模型与不适用模型；模型下拉列表和模型页将不兼容模型置为禁用并说明原因；切换数据集后若当前模型不兼容，自动切换到该数据类型的推荐模型并提示用户。
- 可视化 CNN 使用顺序式层栈，固定输入层、固定 Softmax 输出层，中间允许添加、删除和上下移动：卷积层（滤波器数、3×3 卷积核）、最大池化层（2×2）、全连接层（神经元数）、激活层（ReLU/Tanh/Sigmoid）、Dropout（丢弃率）。
- 浏览器 Web Worker 中实现卷积、最大池化、全连接、激活、Dropout、Softmax 交叉熵、反向传播和小批量 SGD；固定随机种子保证重复训练结果一致。
- 训练画布在该模型下展示网络层栈、每层输出尺寸、参数量、最近激活摘要，以及训练期间持续流动的数据粒子动画；动画遵从 `prefers-reduced-motion`。
- 训练完成显示分类指标和混淆矩阵；图像数据不渲染二维决策边界。

### 不包含

- 任意 DAG、残差/跳连、多输入输出、批归一化、优化器选择、GPU/WebGPU。
- 用户上传 PNG/JPEG、图片文件解析、真实 MNIST 文件下载。
- 自由卷积核大小、步长、填充模式或多通道彩色图像；首版固定单通道、3×3 same 卷积、2×2 最大池化。

## 3. 用户流程

1. 用户在数据集页选择“8×8 数字图像（0–9）”，查看数字缩略图、十类分布、数据集适用模型及不适用模型。
2. 进入实验流程后选择“可视化卷积神经网络”；若选择二维/CSV 表格数据，该选项禁用并显示“仅支持图像数据集”。
3. 用户从添加菜单添加卷积、池化、全连接、激活或 Dropout 层，编辑本层参数，并可上下移动或删除可选层；界面实时验证层顺序、尺寸与参数量。
4. 用户开始训练，Worker 持续回传 epoch、loss、分类指标和层激活摘要；画布播放输入到输出的粒子流，当前层逐层高亮。
5. 训练结束后用户查看损失、十分类指标、混淆矩阵与网络结构；历史记录可恢复模型配置和结果。

## 4. 技术方案

- `Dataset` 增加可选 `dataType`、`imageShape`。兼容函数集中定义在 `workbenchTypes.ts`，由数据集说明、模型选择、训练前校验共用，避免界面与训练规则分叉。
- 图像数据集不新增外部依赖或二进制资源。用 5×7 数字字模渲染到 8×8，再以已有确定性 PRNG 施加小范围变化；每类等量生成，使离线运行、体积和复现性可控。
- `visualCnn.ts` 使用扁平输入与内部三维张量 `channel × height × width`。卷积层采用 3×3、same padding；池化使用 2×2、步长 2；进入全连接层时自动扁平化。训练前验证池化后尺寸不小于 1、卷积/池化只能位于第一个全连接层前、至少保留一个可训练层。
- 每个可训练层保存权重和偏置；前向传播保存激活、卷积输入及池化最大值位置；反向传播按逆序累积梯度并按 batch 平均更新。Dropout 仅训练阶段启用，使用 seeded PRNG 和 inverted dropout。
- `TrainSnapshot` 增加可选 `network` 摘要（各层名称、输出形状、参数量、平均激活绝对值），供动画和结构视图使用；不跨 Worker 传输大型中间特征图。
- 网络画布以普通 React + CSS 实现；每层是带输出尺寸和参数量的卡片，连接线中 CSS 粒子在训练中循环移动。训练暂停或完成时停止流动，降低动态效果干扰。

## 5. 数据结构与接口

```ts
type DatasetDataType = 'tabular' | 'image'

interface ImageShape { width: number; height: number; channels: number }
interface Dataset {
  features: number[][]
  labels: Array<string | number>
  dataType?: DatasetDataType
  imageShape?: ImageShape
}

type VisualLayer =
  | { id: string; type: 'conv2d'; filters: number }
  | { id: string; type: 'max-pool' }
  | { id: string; type: 'dense'; units: number }
  | { id: string; type: 'activation'; activation: 'relu' | 'tanh' | 'sigmoid' }
  | { id: string; type: 'dropout'; rate: number }

interface VisualCnnTrainConfig {
  samples: number[][]
  labels: Array<string | number>
  imageShape: ImageShape
  layers: VisualLayer[]
  learningRate?: number
  epochs?: number
  batchSize?: number
  seed?: number
}
```

`isModelCompatible(model, dataset)` 返回 `{ compatible, reason? }`。`visual-cnn` 对 `image` 返回兼容；其他现有模型对 `tabular` 返回兼容。训练入口再次调用此规则并以中文错误阻止不兼容训练。

## 6. 错误处理

- 图像模型与表格数据集组合：禁用选择；若以旧实验/异常状态绕过界面，训练显示“可视化卷积神经网络仅支持图像数据集”。
- 图像输入长度与图像尺寸不一致、标签不足两类、特征非有限值、层参数越界：阻止训练并显示中文错误。
- 池化导致空间尺寸为零、卷积/池化出现在全连接层之后：构建器即时显示错误并禁用开始训练。
- 无可训练层、层被全部删除、Dropout 超出 `[0, 0.8]`：恢复安全默认层或阻止开始训练。

## 7. 验收标准

- 数据集页面可选择并预览 8×8 数字 0–9；有 10 个类别、64 个特征、图像尺寸和不适用模型提示。
- 表格数据选择时 `visual-cnn` 禁用；图像数据选择时 MLP/KNN/线性模型禁用；训练层再做兼容性保护。
- 用户可新增、删除、排序并编辑卷积、池化、全连接、激活、Dropout；输出形状和参数量随之更新，非法结构无法训练。
- 默认网络 `Conv2D(8) → ReLU → MaxPool → Dense(32) → ReLU → Dropout(0.1) → Output(10)` 能在内置数据集上完成十分类训练，并输出 loss、指标和 10×10 混淆矩阵。
- 同一数据、层结构、参数和随机种子产生相同模型及快照。
- 训练时画布展示逐层高亮和流动粒子；启用减少动态效果偏好时无粒子循环动画。
- 图像模型结果页不显示二维决策边界。

## 8. 测试策略

- Vitest：数字数据集的形状、类别分布和确定性；模型兼容矩阵；层结构校验/输出形状/参数量；CNN 简单数字分类收敛、种子确定性、非法结构；Worker 路由。
- React Testing Library：数据集预览提示、模型禁用状态、网络搭建器添加/排序/删除、训练画布结构与动画状态。
- `npm test`、`npm run lint`、`npm run build`；视需要运行 Playwright 检查数据集到训练流程。

## 9. 实现记录

- 实现状态：已实现
- 验证命令：`npm test`（23 个测试文件、127 个测试通过）；`npm run lint`；`npm run build`
- 已知限制：首版数字由离线确定性字模生成，适合学习卷积与池化，不等同于真实 MNIST 手写笔迹分布。

## 10. 未决问题

- 无。后续若需要真实手写样本，作为单独规格引入经审核的数据资源与图片导入流程。

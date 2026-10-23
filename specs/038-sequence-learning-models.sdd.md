# SDD-038：LSTM 与 Transformer 时序分类实验

- 状态：已完成
- 编号：038
- 创建日期：2026-10-23

## 1. 背景与目标

当前工作台的深度学习实验包括 MLP 与仅适用于图像数据的 CNN。用户希望加入 LSTM 和 Transformer。两种模型需要按时间步组织的输入，因此本功能增加内置时序分类数据，并在浏览器 Worker 中训练两种模型。

## 2. 范围

### 包含

- 新增固定长度序列数据类型，序列样本由时间步和通道组成，并使用现有数值特征矩阵存储展平后的序列。
- 新增确定性的内置时序波形分类数据集，包含多个波形模式及至少两个类别。
- 新增 LSTM 分类器：单层 LSTM 编码序列，使用最终隐藏状态连接 Softmax 分类头。
- 新增 Transformer 分类器：正弦位置编码、单层多头自注意力编码器、前馈层、全局平均池化和 Softmax 分类头。
- 两个模型均支持二分类和多分类，训练过程可产生 epoch 损失快照，参数包含学习率、训练轮数、批大小及随机种子；模型专属参数可调。
- 使用现有 Worker、分类指标、混淆矩阵、实验历史和 JSON 导入导出。
- 模型选择只在时序数据上启用 LSTM/Transformer；选择其中一个模型后准备页自动切换到兼容的内置时序数据。
- 数据预览显示序列长度、通道数和代表性波形，训练页不显示二维决策边界。

### 不包含

- CSV 时序导入、可变长度序列、缺失时间步、掩码和序列预测。
- WebGPU、第三方机器学习库及后端训练。
- Transformer 注意力热力图、模型架构拖拽编辑器和模型自动调参。
- 修改现有 KNN、CNN、MLP 等算法。

## 3. 用户流程

1. 用户在模型选择中选择 LSTM 或 Transformer。
2. 工作台自动选择兼容的“时序波形分类”内置数据集，用户可预览样本序列。
3. 用户调整模型专属参数并确认数据，进入实验流程。
4. 用户开始训练，Worker 按 epoch 输出损失快照；训练完成后查看准确率、宏平均分类指标和混淆矩阵。
5. 用户可保存、查看、导出或导入本次实验记录。

## 4. 技术方案

### 4.1 数据与模型兼容性

- Dataset 增加 dataType = sequence 和 SequenceShape { steps, channels }。
- Dataset.features 中每条序列按时间步优先顺序展平为 steps × channels 个有限数值；labels 为类别标签。
- 内置数据集使用固定 32 个时间步、单通道、确定性随机种子，生成带轻度噪声的不同周期/波形模式。
- LSTM 和 Transformer 仅兼容 dataType = sequence；CNN 仅兼容 image；现有非序列模型保持只兼容 tabular。
- 训练配置接收 sequenceShape，Trainer 内部将展平特征恢复成二维序列。
- 暂不开放序列 CSV 导入，避免用户把普通宽表误当成有序序列。

### 4.2 LSTM

- 使用单层、单向 LSTM；逐时间步计算输入门、遗忘门、输出门和候选状态。
- 最终隐藏状态接入线性 Softmax 分类头，使用交叉熵和小批量反向传播训练。
- 训练检查点按 epoch 暴露暂停/单步/继续能力；在 batch 之间让出控制权。
- 固定随机种子控制参数初始化和 batch 顺序；模型序列化保存权重、偏置、类别顺序、隐藏维度及种子。

### 4.3 Transformer

- 使用单层 encoder，包含固定正弦位置编码、多头缩放点积自注意力、残差连接、LayerNorm 和前馈网络。
- 对时间步表示做全局平均池化，并通过线性 Softmax 分类头输出类别概率。
- 参数校验保证模型维度可被注意力头数整除；固定随机种子控制初始化和 batch 顺序。
- 不显示注意力矩阵，首版用结构说明、训练曲线和分类指标解释模型行为。

### 4.4 集成

- 在 ModelKind、modelGroups、参数定义、训练能力、WorkerTrainConfig、runTrainingInHandler、App trainer/predict 分派中注册新模型。
- 保持训练经 Web Worker 执行；无 Worker 环境仍可通过 runTrainingInHandler 执行以支持测试。
- 持久化校验接受 sequence 数据结构、新模型配置和模型参数；旧版本 tabular/image 实验继续有效。
- 结果仍使用现有 classificationMetrics 和历史结果面板。

## 5. 数据结构/API

- DatasetDataType 增加 sequence。
- 新增 SequenceShape，包含 steps 和 channels。
- Dataset 新增可选 sequenceShape 字段。
- LstmTrainConfig 包含样本、标签、序列形状、隐藏单元数、学习率、训练轮数、批大小及种子。
- TransformerTrainConfig 包含样本、标签、序列形状、模型维度、注意力头数、前馈宽度、学习率、训练轮数、批大小及种子。
- 新增内置数据集标识 sequence-waves。
- 两个 Trainer 均返回与样本等长的预测、分类模型与 epoch snapshots。

## 6. 错误处理

- 特征数必须等于 steps × channels，所有输入值必须为有限数值；标签数量须与样本数一致，且类别至少两个。
- 模型不兼容的数据集在选择控件中禁用；训练入口再次验证并给出中文错误。
- Transformer 的模型维度、头数、前馈宽度、学习率、批大小和轮数越界时禁止开始训练。
- 数值不稳定或 Worker 失败时沿用现有中文训练错误，并保留本轮已收到的快照。
- 持久化导入时校验 sequenceShape 和模型参数，不合法的实验记录拒绝导入。

## 7. 验收标准

1. 使用相同 options seed 生成的时序内置数据完全一致，包含波形、类别和序列形状。
2. 序列数据预览显示 32 个时间步、1 个通道及可读波形图；现有表格模型不显示该数据集。
3. LSTM 和 Transformer 均可在内置数据集上完成二分类和多分类，并输出有限损失、预测类别和分类指标。
4. 相同数据、模型参数与随机种子产生一致模型参数、快照及预测。
5. Transformer 不满足模型维度整除注意力头数时显示可理解的中文错误并阻止训练。
6. 两种模型通过 Web Worker 执行，训练中主线程仍能响应暂停/单步/继续/停止。
7. 序列模型的实验可保存、导出、导入和再次查看；原有实验格式继续兼容。
8. 时序模型不显示二维决策边界。

## 8. 测试策略

- Vitest：序列数据确定性、形状与标签分布；模型兼容矩阵；LSTM 门控与分类收敛、种子复现和异常输入；Transformer 注意力形状、参数校验、分类收敛与种子复现。
- Worker 测试：两种模型路由、epoch 快照，以及 LSTM/Transformer 的暂停、单步和停止控制。
- React Testing Library：序列数据筛选与预览、模型参数、训练曲线、指标和无决策边界。
- 持久化测试：序列形状和两种模型配置的 JSON 往返及非法输入拒绝。
- 验证命令：相关 Vitest、npm test -- --run、npm run build、npm run lint、git diff --check。

## 9. 实现记录

- 实现状态：已完成。已接入固定 32 步、单通道的内置波形分类数据集；完成 LSTM 与 Transformer 的模型兼容和参数配置、Worker 路由、实验流程及指标展示、实验历史和 JSON 持久化校验。
- 验证命令与结果：`npm test -- --run`（40 个测试文件、296 项通过）；`npm run build`（通过）；`npm run lint`（0 警告、0 错误）；`git diff --check`（通过）。App 流程定向检查：`npx vitest run src/App.test.tsx src/App.training.test.tsx --reporter=dot`（2 个文件、17 项通过）。Worker 控制定向检查覆盖两种序列模型的暂停、单步和停止。
- 已知限制：首版仅支持固定长度的内置序列分类数据，暂不支持 CSV 序列、序列预测和注意力热力图。

## 10. 未决问题

- 无。用户已明确要求纳入 LSTM 和 Transformer。

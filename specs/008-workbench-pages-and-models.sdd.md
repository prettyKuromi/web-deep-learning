# 多页面实验工作台与模型扩展

## 背景与目标

当前工作台只有单页视图，顶部阶段按钮不会切换内容，训练完成后仅展示决策边界图，且只支持 KNN。本功能将四个阶段改造成真正的子页面，补充可读的训练说明和历史实验回看，并增加逻辑回归、线性 SVM。

## 范围

- 数据集页：内置二维分类数据集、CSV 上传、当前数据集摘要。
- 模型页：KNN、逻辑回归、线性 SVM 选择及参数说明。
- 训练页：训练参数、进度/日志、指标摘要和决策边界。
- 结果页：历史实验列表、本地持久化、详情回看。
- 统一分类指标：准确率、宏平均 precision/recall/F1、混淆矩阵。
- 不包含账号、后端同步、三维数据和自动发布。

## 用户流程

1. 用户在“数据集”页选择内置数据集或上传 CSV。
2. 用户在“模型”页选择算法并调整参数。
3. 用户在“训练”页开始训练，查看进度与文字说明。
4. 训练完成后自动进入“结果”页，查看本次结果并可回看历史实验。

## 技术方案

- 使用 React 状态与 Zustand store 管理当前数据集、模型配置、训练状态和实验记录。
- 实验记录序列化到 localStorage，启动时恢复。
- 算法统一实现 Trainer 接口：train、predict，并返回 snapshots。
- 逻辑回归使用批量梯度下降；线性 SVM 使用 hinge loss 梯度下降；多分类采用 one-vs-rest。
- 决策边界复用现有图表组件；训练详情由指标卡、说明文本和混淆矩阵组成。

## 数据结构/API

- `ModelKind = 'knn' | 'logistic-regression' | 'linear-svm'`
- `ExperimentRecord`：id、createdAt、dataset、modelKind、config、metrics、snapshots、model、predictions。
- `WorkbenchStore`：activeStage、dataset、modelConfig、training、experiments，以及 set/reset/add/load actions。

## 验收标准

- 四个顶部 tab 可切换并显示对应页面，当前 tab 有明确视觉状态。
- 支持 KNN、逻辑回归、线性 SVM 训练，且相同数据、参数、种子得到一致结果。
- 训练页显示至少训练状态、样本/类别数、模型参数、准确率、precision、recall、F1、混淆矩阵和文字解释。
- 结果页刷新后仍能看到历史实验，并可打开详情回看。
- 空数据、非法 CSV、训练参数异常给出中文错误提示。

## 测试策略

- Vitest：算法预测/训练、指标、store 持久化序列化、页面关键交互。
- Playwright：tab 切换、上传数据集、训练并在结果页回看。
- 验证命令：`npm test`、`npm run build`、`npm run e2e`。

## 未决问题

- localStorage 容量有限，MVP 仅保存最近 20 条实验记录。

## 实现状态

- 已实现单页面工作台布局、CSV/内置数据集、KNN/逻辑回归/线性 SVM、模型参数调节、SVG 训练损失曲线、训练日志与指标详情、混淆矩阵、决策边界和 localStorage 历史记录。
- 验证命令：`npm test`（10 个测试文件、36 个测试通过）；`npm run build`（TypeScript 与 Vite 构建通过）；`npm run lint`（通过）。
- 已知限制：当前训练仍在主线程执行；实验记录仅保留最近 20 条，且 localStorage 容量受浏览器限制。

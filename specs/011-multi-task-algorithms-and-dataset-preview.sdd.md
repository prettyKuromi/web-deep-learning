# SDD-011：多任务算法扩展与数据集预览

- 状态：Approved for implementation
- 编号：011
- 创建日期：2026-08-08

## 1. 背景与目标

当前工作台仅支持 KNN、逻辑回归和线性 SVM 三种分类算法。扩展分类、回归、聚类和降维任务，并在模型页按任务类型分组；同时增强数据集页，预览内置或用户上传的数据并展示规模、字段和特点说明。

## 2. 范围

### 包含

- 任务类型分组：分类、回归、聚类、降维。
- 新增首批算法：决策树、朴素贝叶斯、线性回归、岭回归、K-Means、PCA。
- 复用二维数值特征；分类/回归要求标签，聚类/PCA 标签可选。
- 数据集预览：样本表格、样本量、特征数、标签/缺失值统计、内置数据集特点说明。
- 用户上传 CSV 后显示同样的预览与统计信息。

### 不包含

- 三维数据、深度学习、后端训练和自动超参数搜索。
- 本阶段不实现 DBSCAN、随机森林、Lasso 等后续算法。

## 3. 用户流程

1. 用户在数据集页选择内置数据集或上传 CSV。
2. 页面显示数据预览、规模统计和数据集特点。
3. 用户在模型页先切换任务类型，再选择该类型下的算法与参数。
4. 训练页和结果页根据任务类型展示对应曲线、可视化和指标。

## 4. 技术方案

- 扩展 `ModelKind` 与统一 Trainer 注册表，保留现有 train/predict 契约。
- 分类沿用决策边界和 Accuracy/Precision/Recall/F1；回归新增预测散点和 MAE/MSE/RMSE/R²；聚类新增簇中心、簇标签和轮廓系数/惯性；PCA 展示主成分投影和方差解释率。
- 训练继续通过 Worker 执行；算法优先使用简洁、可解释的 TypeScript 自实现。
- 模型页使用任务类型标签切换算法列表，参数面板按算法动态渲染。
- 数据集统计由纯函数计算，上传和内置数据共用预览组件。

## 5. 数据结构/API

```ts
type TaskKind = 'classification' | 'regression' | 'clustering' | 'dimensionality-reduction'
type ModelKind =
  | 'knn' | 'logistic-regression' | 'linear-svm' | 'decision-tree' | 'naive-bayes'
  | 'linear-regression' | 'ridge-regression' | 'k-means' | 'pca'
```

数据集元信息至少包含 `sampleCount`、`featureCount`、`labelCount`（可选）、`missingCount`、`description` 和 `characteristics`。

## 6. 错误处理

- 不符合任务要求的标签（如回归标签非数值）阻止训练并给出中文提示。
- 空数据、特征维度不一致、参数越界和 CSV 非法行继续沿用现有错误提示机制。
- 聚类/PCA 无标签时明确显示“无监督任务”。

## 7. 验收标准

- 模型页可切换四种任务类型，列表只显示对应算法。
- 九种算法均可选择并显示参数说明；新增算法至少可完成训练或计算并输出结果。
- 数据集页可预览内置和上传数据，显示规模、字段统计及特点说明。
- 相同数据、参数和随机种子得到一致结果。
- 原有分类流程和测试不回归。

## 8. 测试策略

- Vitest 覆盖任务分组、数据集统计、算法核心预测/训练和错误处理。
- Playwright 覆盖任务类型切换、上传数据预览和训练入口。
- 验证命令：`npm test`、`npm run build`、`npm run lint`。

## 9. 实现记录

- 实现状态：进行中（训练核心已支持线性回归、岭回归、K-Means、PCA、决策树、高斯朴素贝叶斯，并接入 Worker 配置分发）
- 验证命令：`npm test -- src/features/training/__tests__/training.test.ts`；`npm run build`
- 已知限制：首批算法仍限定二维数值特征。

## 10. 未决问题

- 回归和无监督结果的图表样式沿用现有图表容器，具体视觉细节在实现中保持最小改动。

## ʵ�ּ�¼��ģ��ѡ����飩
- ģ��ѡ��ҳ�����ࡢ�ع顢���ࡢ��ά���������л�����չʾ��Ӧ�㷨��
- ModelKind ��չ�����������㷨���������Ϊ�����㷨Ԥ�����á�
- ��֤���npm test -- --run src/features/workbench/pages.test.tsx src/features/workbench/StepLabPages.test.tsx��npm run build��

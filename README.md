# Web Deep Learning

一个文档驱动的浏览器端机器学习实验工作台。

## 当前阶段

项目目前处于设计与规格阶段，尚未开始实现。总体设计见 [`specs/000-project-design.sdd.md`](specs/000-project-design.sdd.md)。后续功能必须遵循根目录 [`AGENTS.md`](AGENTS.md) 中的 SDD 流程。

## MVP 目标

在浏览器中完成二维分类数据的导入、模型训练、训练过程可视化、决策边界展示、指标评估、实验保存和 JSON 导入导出。首批模型为 KNN、逻辑回归和线性 SVM。

## 当前实现说明

项目在浏览器本地运行，训练通过 Web Worker 执行；支持分类、回归、聚类和 PCA 结果视图。实验历史以 IndexedDB（Dexie）保存最近 20 条，可在历史页导入、导出和删除 JSON。CSV 约定第一行为表头、最后一列为标签，其余列为数值；当前不支持无标签或字段映射。分类指标明确为训练集指标，不能代表泛化能力。

验证命令：npm test -- --run、npm run lint、npm run build。

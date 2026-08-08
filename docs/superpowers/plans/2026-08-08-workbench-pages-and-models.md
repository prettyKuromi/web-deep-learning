# Workbench Pages and Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将单页工作台升级为可切换的四页面实验应用，增加训练解释、历史结果持久化和两种分类模型。

**Architecture:** Zustand 管理工作区状态与 localStorage 持久化；算法通过统一 Trainer 接口暴露；App 根据 activeStage 渲染四个页面组件，结果页复用可视化组件展示详情。

**Tech Stack:** React 19、TypeScript、Zustand、Vitest、Playwright、现有 ECharts/Canvas 图表。

---

### Task 1: 扩展训练算法与统一结果

**Files:** `src/features/training/types.ts`, `src/features/training/logisticRegression.ts`, `src/features/training/linearSvm.ts`, tests in `src/features/training/__tests__`.

- [ ] 为模型配置、训练结果和两个新 trainer 编写失败测试。
- [ ] 实现 one-vs-rest 逻辑回归与线性 SVM，输出 snapshots 和统一预测接口。
- [ ] 运行训练测试并确认通过。

### Task 2: 工作区 store 与实验持久化

**Files:** `src/app/workbenchStore.ts`, `src/app/workbenchTypes.ts`, tests in `src/app`.

- [ ] 编写 store 初始状态、模型配置、添加实验和 localStorage 恢复测试。
- [ ] 实现 Zustand store，限制最近 20 条记录。
- [ ] 运行 store 测试。

### Task 3: 四页面 UI 与训练详情

**Files:** `src/App.tsx`, `src/App.css`, new page components under `src/features/workbench/`.

- [ ] 编写 tab 切换、训练详情和结果回看交互测试。
- [ ] 实现 Dataset/Model/Training/Results 页面并接入 store。
- [ ] 增加中文指标说明、混淆矩阵和日志展示。
- [ ] 运行组件测试。

### Task 4: 集成验证与规格回填

**Files:** `specs/008-workbench-pages-and-models.sdd.md`, `e2e/` as needed.

- [ ] 运行 `npm test`、`npm run build`、`npm run e2e`。
- [ ] 修复集成问题并在 SDD 中填写实现状态、验证命令和已知限制。

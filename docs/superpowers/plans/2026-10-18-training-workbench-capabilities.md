# 训练工作台核心能力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将训练控制、泛化评估和实验比较从 UI 级功能提升为可验证的产品能力。

**Architecture:** 保留 React、Web Worker、Trainer 和 Dexie 架构。三个独立切片分别统一 Worker 运行时契约、在训练编排边界进行确定性数据划分与评估、在历史页呈现实验比较；旧实验结构通过可选元数据保持兼容。

**Tech Stack:** TypeScript、React、Zustand、Web Worker、Dexie、Vitest、Playwright。

---

## 文件边界

- 运行时切片：修改 `src/features/training/types.ts`、`workerClient.ts`、`trainingControl.ts`、`src/workers/training.worker.ts` 和对应训练测试；不改 `App.tsx` 或历史页。
- 评估切片：新增 `src/features/training/evaluation.ts` 及测试，修改 `src/App.tsx`、`src/app/workbenchTypes.ts`、`CurrentResultPanel.tsx`、`ExperimentResultPanel.tsx` 和相关测试；不改历史列表交互。
- 比较切片：新增 `src/features/workbench/ExperimentComparison.tsx` 及测试，修改 `HistoryPage.tsx`、`HistoryPage.test.tsx`、`pages.css`；复用实验记录，不修改 Worker 与训练流程。

### Task 1: 统一 Worker 训练运行时

Files:
- Modify `src/features/training/types.ts`
- Modify `src/features/training/workerClient.ts`
- Modify `src/features/training/trainingControl.ts`
- Modify `src/workers/training.worker.ts`
- Test `src/features/training/workerClient.test.ts`
- Test `src/features/training/trainingControl.test.ts`

- [ ] 先为运行 ID 隔离、Worker 事件和控制确认编写失败测试。
- [ ] 执行 `npm test -- --run src/features/training/workerClient.test.ts src/features/training/trainingControl.test.ts`，确认失败原因是新契约未实现。
- [ ] 增加能力类型、事件联合类型和状态转换函数；只在 Worker 事件到达时推进状态。
- [ ] 接入运行 ID、事件确认及终止清理；旧 run 消息不得更新当前运行。
- [ ] 重跑上述测试及训练相关测试，确认状态/控制协议通过。

### Task 2: 确定性训练/验证评估

Files:
- Create `src/features/training/evaluation.ts`
- Create `src/features/training/evaluation.test.ts`
- Modify `src/App.tsx`
- Modify `src/app/workbenchTypes.ts`
- Modify `src/features/workbench/CurrentResultPanel.tsx`
- Modify `src/features/workbench/ExperimentResultPanel.tsx`
- Test `src/App.test.tsx` and result panel tests

- [ ] 先写确定性分层划分、极小类别错误和验证集未泄漏的失败测试。
- [ ] 运行 `npm test -- --run src/features/training/evaluation.test.ts` 并确认失败。
- [ ] 实现 seeded split 和监督任务指标计算，训练仅接收训练子集。
- [ ] 把训练/验证样本数、指标来源及评估配置保存到可选实验元数据。
- [ ] 展示训练集与验证集指标，区分训练/验证曲线；旧记录缺字段时回退到已有结果展示。
- [ ] 运行评估单测、结果面板测试和 App 测试。

### Task 3: 历史实验比较

Files:
- Create `src/features/workbench/ExperimentComparison.tsx`
- Create `src/features/workbench/ExperimentComparison.test.tsx`
- Modify `src/features/workbench/HistoryPage.tsx`
- Modify `src/features/workbench/HistoryPage.test.tsx`
- Modify `src/features/workbench/pages.css`

- [ ] 先写 2 至 4 条选择约束、旧记录和不可比曲线的失败测试。
- [ ] 运行 `npm test -- --run src/features/workbench/ExperimentComparison.test.tsx` 并确认失败。
- [ ] 实现比较选择、差异表、指标口径提示和兼容曲线叠加。
- [ ] 确认历史详情查看与导入/导出行为仍工作。
- [ ] 运行比较组件与 HistoryPage 测试。

### Task 4: 全量验证与提交

- [ ] 执行 `npm test -- --run`、`npm run lint`、`npm run build`。
- [ ] 执行项目 Playwright：`npx playwright test --config=test-results/installed-chrome.config.cjs`。
- [ ] 更新三个 SDD 的实现状态、验证命令和限制。
- [ ] 只 stage 源码、测试和 `specs/`；不提交 `test-results/`。
- [ ] 在 `main` 使用中文提交信息提交每个完成切片。

# 工作台训练语义修复实施计划

> **执行要求：** 由子代理按任务实现；每项遵循测试先行、完成验证后以中文提交。

**目标：** 修正集成算法、回归指标与 Worker 停止语义，并使项目说明准确反映已实现能力和限制。

**架构：** 在现有 Trainer、Worker、ExperimentRecord 和 SDD 边界内做窄范围修复。随机性用显式 seed 控制；回归页面消费实验记录中的训练指标；停止由 Worker 客户端立即终止执行线程。文档更新留在根代理集中完成。

**技术栈：** React、TypeScript、Vitest、Playwright、Web Worker、Dexie。

---

## 前置规格

- specs/037-training-semantics-and-evaluation-corrections.sdd.md 是唯一验收来源；代码改动前已创建。
- 分支必须保持 main；每个子任务提交中文 commit，不推送。

## 任务一：随机森林与 K-Means 的可复现初始化

文件：
- 修改 src/features/training/types.ts、src/features/training/decisionTree.ts、src/features/training/ensembles.ts、src/features/training/kmeans.ts、src/features/training/modelParameters.ts。
- 修改或新增对应算法测试，优先放在 src/features/training/__tests__/training.test.ts。

- [ ] 先加测试并运行 npm.cmd test -- --run src/features/training/__tests__/training.test.ts：随机森林同 seed 结果一致；在 XOR 样本上 seed 固定时出现多种根特征；K-Means 固定 seed 重复初始化结果一致，且初始化不再等于输入前 k 行。新断言应先失败。
- [ ] 给决策树增加可选的随机候选特征配置；默认配置仍遍历所有特征。
- [ ] 随机森林对每棵树有放回抽样 N 次，用派生的确定性 seed 在每个节点抽取 max(1, floor(sqrt(p))) 个候选特征；增加 seed 参数定义，默认 42。
- [ ] K-Means 使用 seed 驱动的 k-means++ 选中心，增加 UI seed 参数定义，默认 42。
- [ ] 重新运行相关测试、npm.cmd run build；提交“修正集成算法随机性并保持可复现”。

## 任务二：回归指标使用正确数据划分

文件：
- 修改 src/features/workbench/ExperimentResultPanel.tsx。
- 新增 src/features/workbench/ExperimentResultPanel.test.tsx。

- [ ] 构造一个训练集指标与全量指标明显不同的回归记录；先断言训练卡片显示 evaluation.trainMetrics 且不显示全量误差，运行该测试确认失败。
- [ ] 对启用验证集但缺少 trainMetrics 的旧记录显示“训练集指标未记录”；在未启用评估时保留以全量训练数据计算指标的兼容行为。
- [ ] 测试验证集指标独立展示；运行组件测试和生产构建；提交“修正回归训练集指标展示口径”。

## 任务三：停止时立即终止 Worker

文件：
- 修改 src/features/training/workerClient.ts。
- 修改 src/features/training/workerClient.test.ts 和必要的 src/App.training.test.tsx。

- [ ] 加 Worker 不响应的用例，先执行 npm.cmd test -- --run src/features/training/workerClient.test.ts 并确认新用例失败。
- [ ] 让客户端在 sendControl('stop') 时立即发出一个停止事件、终止 Worker 并以 AbortError 结束运行；重复停止和迟到消息不得重复结束 Promise。暂停、继续、单步仍发送给 Worker。
- [ ] 覆盖 App 停止状态保存既有快照、不保存最终模型或指标；运行 Worker 与 App 相关测试、构建；提交“修复训练停止响应并保留中间记录”。

## 任务四：文档与规格对齐（根代理）

文件：
- 修改 README.md、specs/000-project-design.sdd.md、specs/025-product-readiness.sdd.md、specs/032-reproducible-runs.sdd.md、specs/033-workbench-navigation-and-visualization.sdd.md、specs/034-merged-model-dataset-selection.sdd.md。
- 最终更新 specs/037-training-semantics-and-evaluation-corrections.sdd.md 的实现记录。

- [ ] 把 README 当前阶段改为已实现教学工作台，列出 15 个模型与 4 类任务，写清 CSV 约束、合成图像和评估边界。
- [ ] 更新 SDD-000 的状态、当前能力和产品限制，保留它作为演进记录，不把当前实现误标为未开始。
- [ ] 对 025、032、033、034 的状态按代码与已有验收记录对齐；只改实际已完成或本次修复后能确认的状态，不伪造浏览器验收。
- [ ] 将剩余限制写为明确范围，不在本任务实现字段映射、标准化、测试集/交叉验证、真实图像输入或大数据优化。
- [ ] 最终执行完整 Vitest、lint、build、git diff --check；回填 SDD-037 实际结果，中文提交“更新工作台文档与规格状态”。

## 最终复核

- [ ] 逐条对照 SDD-037 验收标准，检查代码与文档；核对主分支提交历史和工作区状态。
- [ ] 不推送更改；最终答复说明修复内容、测试结果、限制与提交 ID。
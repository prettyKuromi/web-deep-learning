# SDD-009：MVP 核心能力补齐

- 状态：Partially Implemented
- 编号：009
- 创建日期：2026-08-08

## 1. 背景与目标

补齐当前工作台与总体设计之间的关键差距：训练异步化、实验持久化与 JSON 交换、四阶段页面导航和关键端到端验证。

## 2. 范围

包含：

- 使用 Web Worker 执行 KNN、逻辑回归和线性 SVM 训练，支持快照、完成、失败和取消。
- 使用 Dexie/IndexedDB 保存最近实验，支持查询、删除和 JSON 导入导出。
- 接入数据集、模型、训练、结果四阶段页面，并保持当前实验状态。
- 增加 Playwright 关键流程测试。

不包含：账号、云端同步、后端训练、三维数据和新模型。

## 3. 技术方案

- Worker 消息使用 `start`、`snapshot`、`complete`、`error`、`cancel` 五种类型。
- Worker 客户端暴露 `trainInWorker(config, onSnapshot, signal)`，取消通过 `AbortSignal` 转换为 Worker `cancel` 消息。
- 持久化模块提供 `saveExperiment`、`listExperiments`、`deleteExperiment`、`exportExperiments`、`importExperiments`。
- JSON 文件带 `version` 字段，导入时校验必填字段和版本。
- 页面导航复用现有页面组件，主应用只保留一个状态源。

## 4. 验收标准

- 训练期间主线程保持可交互，可取消并显示可读状态。
- 相同数据、参数和随机种子结果一致。
- 实验刷新后可恢复；可删除、导出并重新导入。
- 四个阶段可切换，训练完成后结果页可查看详情。
- `npm test`、`npm run build`、`npm run lint` 和 `npm run e2e` 均通过。

## 5. 测试策略

- Vitest：Worker 协议、持久化校验、JSON 版本和页面状态流转。
- Playwright：选择数据集、切换模型、训练、查看结果、导出导入。

## 6. 实现状态与已知限制

- 当前状态：已完成 Worker 训练协议、Dexie/内存回退持久化、JSON 版本校验、四阶段导航组件和 Playwright 流程文件；主应用已接入 Worker 训练和持久化保存。
- 验证命令：`npm test -- --run`（12 个测试文件、46 个测试通过）；`npm run build`；`npm run lint`。
- 已知限制：Playwright 运行需要本机安装 Chromium；主应用仍保留单页内容布局，导航组件已接入但未按阶段隐藏所有卡片；导入导出按钮尚未接入可见 UI。

## 11. 后续改进：导入与迁移容量保护（2026-10-24）

- 背景与目标：历史保存上限为最近 20 条；导入或迁移超过容量时不得在没有提示的情况下裁掉记录或删除旧来源。
- 技术方案：JSON 导入与旧历史迁移在写入前按记录 ID 合并并检查容量；若超过 20 条且会丢弃记录，整次操作原子失败并显示中文错误。迁移失败时保留 localStorage 原始数据。普通训练保存仍按最近 20 条保留。
- 验收标准：导入超过容量的记录包不会修改现有历史；导入与现有历史合并后超过容量时不会部分写入；超量旧历史迁移失败后原 localStorage 键仍存在。
- 测试策略：覆盖 21 条导入、容量已满时新增一条唯一导入记录、超量迁移及失败后的数据/来源保留。
- 实现状态：已实现。`importExperiments` 与历史迁移在同一事务内合并并预检容量，超过 20 条时拒绝整批写入；旧 localStorage 来源仅在迁移成功后删除，普通保存仍保留最近 20 条。
- 验证命令：`npm test -- --run`（41 个测试文件、324 项通过）；`npm run build`；`npm run lint`；`git diff --check`。
- E2E 状态：已尝试 `npm run e2e`，17 项均在浏览器启动前失败，原因是本机缺少 Playwright Chromium；`npx playwright install chromium` 在当前环境超时，尚未完成浏览器验证。

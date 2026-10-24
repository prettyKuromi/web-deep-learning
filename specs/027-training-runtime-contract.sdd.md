# SDD-027：统一训练运行时与模型能力契约

## 背景与目标

训练 UI 目前依靠字符串状态和模型白名单推断控制能力。Worker 事件不覆盖准备、初始化、停止和单步完成；不同算法的快照单位也不统一。建立可测试的运行时协议，使 UI 能按 Worker 确认的阶段和算法能力呈现状态。

## 范围

- 为模型定义训练单位、总量及暂停/单步/停止能力。
- Worker 使用带运行 ID 的事件协议报告准备、初始化、开始、快照、控制确认、完成、取消和失败。
- 对迭代型训练器在训练单位边界响应控制；长批次至少响应停止/取消。
- 非测试运行环境缺少 Web Worker 时，工作台以中文错误拒绝训练，不调用主线程 handler，并按重置语义清除当前运行的快照、指标、进度和运行 ID。Vitest 测试模式保留 handler 回退；支持检查点控制的模型使用真实任务队列让出并响应停止/取消，其他模型仅保留现有测试用途。底层 `runTrainingInHandler` API 继续供测试及 Worker 复用。
- UI 状态转换由运行时事件驱动，忽略已结束或旧运行的事件。
- 不支持暂停/单步的算法明确声明 `fit` 或实际阶段单位，不伪造百分比。

## 用户流程

用户开始训练后看到 Worker 确认的准备、初始化和运行阶段；控制操作显示请求中状态，待 Worker 确认后更新。单步只完成一个训练单位。完成、停止、取消、失败分别结束运行，并阻止旧运行事件覆盖新状态。

## 技术方案

保留现有 Worker 与 Trainer 架构，定义 `TrainingCapability`、`TrainingEvent` 与 `TrainingRunState` 联合类型。每个运行分配唯一 `runId`，快照携带真实训练单位、当前值/总量和时间戳。控制命令由 Worker 在 Trainer checkpoint 处理，明确确认事件。分类/树数量等算法单位来自模型注册表，不由组件按名称猜测。

## 数据结构/API

```ts
type TrainingUnit = 'iteration' | 'epoch' | 'tree' | 'round' | 'fit'
interface TrainingCapability {
  unit: TrainingUnit
  total?: number
  canPause: boolean
  canStep: boolean
  canStop: boolean
}
type TrainingEvent =
  | { type: 'preparing' | 'initializing' | 'started' | 'paused' | 'resumed' | 'step-completed' | 'stopped' | 'cancelled' | 'completed'; runId: string }
  | { type: 'snapshot'; runId: string; snapshot: TrainSnapshot; capability: TrainingCapability }
  | { type: 'failed'; runId: string; errorCode: string; message: string }
```

现有实验 JSON 兼容；新字段可选。Trainer snapshot 的 `iteration` 保持旧格式兼容，新增 `unit`/`step` 明确真实语义。

## 验收标准

- 每个模型的控制能力和训练单位有集中定义且覆盖测试。
- 每个开始的 run 有唯一 ID；不同 run 的延迟消息不会改变当前状态。
- 暂停、单步、继续、停止由 Worker 确认；单步恰推进一个声明的训练单位。
- 控制不适用的算法不展示误导的进度或可用操作。
- Worker 异常、用户取消、用户停止、自然完成可区分。
- 非测试运行环境缺 Worker 时显示中文错误并拒绝开始训练，且清除旧运行结果；测试模式下协作式模型通过真实任务队列让步，停止能在检查点终止并保留快照。
- 训练期间只禁用模型与数据配置页；历史记录和实验流程可互相切换。由历史记录返回正在运行的实验流程时，运行、快照和控制状态继续，不清空或取消本轮训练。

## 测试策略

- Vitest 覆盖能力注册表、状态转换、旧 run 事件隔离和 Worker 控制确认。
- 对支持控制的迭代 Trainer 覆盖暂停等待、单步一步、继续及停止。
- 模拟 Worker 不存在：非测试模式断言中文拒绝提示、清除旧快照/指标/进度且不创建主线程训练；测试模式协作模型断言任务队列可运行且点击停止后保存停止快照。
- 活动训练时由实验流程切至历史记录再返回，断言训练状态、运行 ID、已有快照和控制能力保留；配置页保持禁用。
- Playwright 使用足够长的训练观察多个运行态快照并操作控制。

## 未决问题

- 对单次拟合模型使用 `fit` 单位，无百分比；其停止能力由 Worker termination 保证。
- 训练/验证指标归属由 SDD-028 定义。

## 实现状态

- 状态：已实现运行时契约及工作台事件接入。
- 实现内容：新增 `trainingCapabilities.ts` 集中声明模型训练单位与控制能力；`TrainingEvent` 为 Worker 阶段、快照、控制确认和失败事件提供唯一 `runId`；Worker 在准备、初始化、开始、暂停/继续、单步完成、完成、停止、取消和失败时发送事件；App 按当前 `runId` 消费事件并按能力展示单位、总量和控制按钮。
- 本次修订：无 Worker 的非测试运行会显示中文拒绝提示；Vitest 回退只在测试模式启用，受支持模型每次控制检查点都让出事件队列并支持停止；运行期间可在历史记录与实验流程间往返，配置页保持锁定。
- 验证命令：`node_modules\.bin\vitest.cmd run src\App.test.tsx src\App.training.test.tsx src\App.workflow-reset.test.tsx src\features\training\workerClient.test.ts src\features\training\trainingControl.test.ts src\features\training\visualCnn.test.ts --pool=forks --maxWorkers=1 --minWorkers=1 --reporter=dot`（6 个文件、53 项通过）；`npm run build`（TypeScript 检查与 Vite 构建通过）。拒绝开始训练时的测试还验证旧快照、指标、进度和运行 ID 已清除。
- 已知限制：浏览器端暂停/单步/停止的长训练流程仍需专门慢速 Playwright 场景验证；一次性拟合模型不支持暂停和单步；正式运行环境缺少 Worker 时所有工作台训练都会拒绝开始。

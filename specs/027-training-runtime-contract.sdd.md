# SDD-027：统一训练运行时与模型能力契约

## 背景与目标

训练 UI 目前依靠字符串状态和模型白名单推断控制能力。Worker 事件不覆盖准备、初始化、停止和单步完成；不同算法的快照单位也不统一。建立可测试的运行时协议，使 UI 能按 Worker 确认的阶段和算法能力呈现状态。

## 范围

- 为模型定义训练单位、总量及暂停/单步/停止能力。
- Worker 使用带运行 ID 的事件协议报告准备、初始化、开始、快照、控制确认、完成、取消和失败。
- 对迭代型训练器在训练单位边界响应控制；长批次至少响应停止/取消。
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

## 测试策略

- Vitest 覆盖能力注册表、状态转换、旧 run 事件隔离和 Worker 控制确认。
- 对支持控制的迭代 Trainer 覆盖暂停等待、单步一步、继续及停止。
- Playwright 使用足够长的训练观察多个运行态快照并操作控制。

## 未决问题

- 对单次拟合模型使用 `fit` 单位，无百分比；其停止能力由 Worker termination 保证。
- 训练/验证指标归属由 SDD-028 定义。

## 实现状态

- 状态：已实现兼容版运行时契约。
- 实现内容：新增 `trainingCapabilities.ts` 集中声明模型训练单位与控制能力；`TrainingEvent` 为 Worker 阶段、快照、控制确认和失败事件提供唯一 `runId`；Worker 在准备、初始化、开始、暂停/继续、单步完成、完成、取消和失败时发送事件；旧 `trainInWorker` 调用和旧消息格式保持兼容。
- 验证命令：`npm test -- --run src/features/training/workerClient.test.ts src/features/training/trainingControl.test.ts src/features/training/trainingCapabilities.test.ts`；`npm run build`。
- 已知限制：现有页面仍以旧状态字符串渲染，尚未消费完整 `TrainingEvent` 时间线；停止事件在现有控制 API 中与取消共享终止路径，调用方可通过发送的控制命令区分。

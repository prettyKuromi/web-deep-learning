# 工作台画布阶段转换实施计划

> **给执行代理的要求：** 使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务逐步执行。步骤使用复选框（`- [ ]`）跟踪。

**目标：** 让 CNN 进入工作台时先查看网络结构、开始训练时展示训练过程、训练完成时自动查看结果，同时保持非完成终态的上下文。

**技术方案：** 继续在 `SinglePageWorkbench` 内协调现有三个画布页签，不改训练引擎和持久化。模型变化时选择对应默认页；训练开始与完成态是显式阶段转换，只有完成态自动切换结果，完成后的手动选择对普通重渲染稳定。

**技术栈：** React、TypeScript、Vitest、React Testing Library、npm scripts。

---

## 文件与职责

- `specs/039-workbench-canvas-stage-transitions.sdd.md`：阶段默认值、完成/非完成转换和验收事实来源；本计划执行前置条件，代码不得超出此规格。
- `specs/037-workflow-reentry-and-canvas-layout.sdd.md`：保留既有重入/布局要求并链接新阶段规则，消除旧默认行为与 SDD-039 冲突。
- `src/features/workbench/SinglePageWorkbench.test.tsx`：页签默认选择、手动选择保持和状态转换回归测试。
- `src/features/workbench/SinglePageWorkbench.tsx`：按当前模型初始化/重选默认阶段，并处理开始、成功完成、重置等既有用户操作的阶段转换。

## Task 1：补充模型默认阶段与重入测试

**Files:**

- Modify: `src/features/workbench/SinglePageWorkbench.test.tsx`
- Test: `src/features/workbench/SinglePageWorkbench.test.tsx`

- [ ] **Step 1：调整 CNN 初始页签测试并添加模型映射测试**

将现有测试 `CNN 默认显示空训练画布，并可在独立页签编辑网络结构` 改为断言初始时“网络结构”选中且网络流已显示；再点击“训练过程”断言空训练画布和空态。新增测试 `普通模型默认训练过程页签，CNN 默认网络结构页签`，分别以 `baseProps` 普通模型与有效图像数据下的 `visual-cnn` 渲染，断言各自的 `aria-selected="true"` 页签。

- [ ] **Step 2：添加模型变更与重入/重置测试**

新增测试覆盖：同一组件从普通模型 rerender 为 `visual-cnn` 后默认选中“网络结构”，再切回普通模型后默认选中“训练过程”；在同一 CNN 模型下手动选择“训练过程”后仅修改参数并 rerender，仍选中“训练过程”；CNN 卸载并以相同 CNN props 重挂载后选中“网络结构”；点击重置时，CNN 选中“网络结构”而非 CNN 的非模型类型保持“训练过程”。将现有 `开始训练和重置训练时自动切回训练过程页签` 拆分：开始训练在 CNN 和非 CNN 下均选“训练过程”，重置按当前模型选择默认页签。

- [ ] **Step 3：运行定向测试确认新断言暴露现状**

Run: `npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx`

Expected: FAIL，至少暴露 CNN 初始默认、模型切换和 CNN 重置选择仍为训练过程的问题；不要为通过测试提前改产品代码。

- [ ] **Step 4：提交测试用例**

```powershell
git add src/features/workbench/SinglePageWorkbench.test.tsx
git commit -m "补充工作台模型阶段默认测试"
```

## Task 2：实现按模型默认阶段选择

**Files:**

- Modify: `src/features/workbench/SinglePageWorkbench.tsx`
- Test: `src/features/workbench/SinglePageWorkbench.test.tsx`

- [ ] **Step 1：实现默认阶段映射及模型变化响应**

在工作台画布状态逻辑中复用现有 `CanvasView`，将 `visual-cnn` 映射至 `architecture`，其余模型映射至 `training`。首次渲染与模型标识变化时选择该默认阶段；不要在同一模型的参数、训练状态或其他 props 变化时重置页签。重置训练回调先选当前模型的默认阶段再调用现有回调；`startTraining` 仍先选 `training` 再启动训练。

- [ ] **Step 2：运行工作台定向测试**

Run: `npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx`

Expected: PASS，包含 CNN/非 CNN 初始阶段、模型切换、重置、卸载重入和开始训练断言。

- [ ] **Step 3：提交默认阶段行为**

```powershell
git add src/features/workbench/SinglePageWorkbench.tsx src/features/workbench/SinglePageWorkbench.test.tsx
git commit -m "实现工作台按模型选择默认阶段"
```

## Task 3：补充完成与非完成终态转换测试

**Files:**

- Modify: `src/features/workbench/SinglePageWorkbench.test.tsx`
- Test: `src/features/workbench/SinglePageWorkbench.test.tsx`

- [ ] **Step 1：添加成功完成状态自动呈现结果的测试**

新增测试 `训练完成后自动切到结果与解释` 与 `训练完成但保存失败仍自动切到结果与解释`。分别先以 `status="训练中…"` 渲染，然后用 `rerender` 更新为 `训练完成` 或 `训练完成，保存失败`；断言结果 tab `aria-selected="true"` 且结果面板显示传入的本轮结果。完成后点击 CNN 的“网络结构”或“训练过程”，再仅改变非状态 props rerender，断言用户选中页仍保持。

- [ ] **Step 2：添加失败、停止与取消上下文保持测试**

新增终态表驱动测试，覆盖 `训练失败`、`训练已停止`、`训练已取消`。每种状态从 `训练中…` 更新前先选择 CNN“网络结构”（另以普通模型“训练过程”验证也可），更新状态后断言当前 tab 仍被选中，没有自动切到“结果与解释”。保留现有未完成结果空态测试，并确保它继续断言可手动打开结果页。

- [ ] **Step 3：运行定向测试确认转换断言暴露现状**

Run: `npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx`

Expected: FAIL，正常完成和保存失败状态不会自动选择结果；失败类状态应保持手动选中的页签。不要在本任务修改产品组件。

- [ ] **Step 4：提交终态测试用例**

```powershell
git add src/features/workbench/SinglePageWorkbench.test.tsx
git commit -m "补充训练完成与终态页签测试"
```

## Task 4：实现完成时自动打开结果页

**Files:**

- Modify: `src/features/workbench/SinglePageWorkbench.tsx`
- Test: `src/features/workbench/SinglePageWorkbench.test.tsx`

- [ ] **Step 1：实现只在完成态进入时自动切换结果**

当当前训练状态进入 `训练完成` 或 `训练完成，保存失败` 时选择 `results`。其他状态（包括 `训练失败`、`训练已停止`、`训练已取消`）不触发页签切换。完成后的后续普通 rerender 不得反复覆盖用户的手动页签选择；开始训练仍回到 `training`，CNN 结构 tab 在训练期间保持可用。

- [ ] **Step 2：运行工作台定向测试**

Run: `npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx`

Expected: PASS，覆盖两种完成状态自动显示结果、完成后手动切页保持、失败/停止/取消保留当时上下文，以及工作台现有页签行为。

- [ ] **Step 3：提交完成态阶段转换**

```powershell
git add src/features/workbench/SinglePageWorkbench.tsx src/features/workbench/SinglePageWorkbench.test.tsx
git commit -m "训练完成后自动展示实验结果"
```

## Task 5：全量验证并回写实现记录

**Files:**

- Modify: `specs/039-workbench-canvas-stage-transitions.sdd.md`
- Test: `src/features/workbench/SinglePageWorkbench.test.tsx`

- [ ] **Step 1：运行定向与全项目验证**

```powershell
npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx
npm.cmd run build
npm.cmd run lint
git diff --check
```

Expected: 定向测试、TypeScript/Vite 构建、lint 均成功；`git diff --check` 无输出且退出码为 0。任一命令失败时先修复对应实现或断言，再完整重跑相关验证。

- [ ] **Step 2：更新规格实现记录**

在 `specs/039-workbench-canvas-stage-transitions.sdd.md` 第 9 节将状态改为已完成，记录每个实际执行的验证命令及结果、浏览器验收（若执行）和已知限制；不写未运行的命令为通过。复查 SDD-037 交叉引用与验收标准仍无冲突。

- [ ] **Step 3：提交规格实现记录**

```powershell
git add specs/039-workbench-canvas-stage-transitions.sdd.md
git commit -m "记录工作台画布阶段转换实现与验证"
```

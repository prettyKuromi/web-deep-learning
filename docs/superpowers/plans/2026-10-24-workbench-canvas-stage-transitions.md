# 工作台画布阶段转换实施计划

> **给执行代理的要求：** 使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务逐步执行。步骤使用复选框（`- [ ]`）跟踪。

**目标：** 让 CNN 进入工作台时先查看网络结构、开始训练时展示训练过程、训练完成时自动查看结果，同时保持非完成终态的上下文。

**技术方案：** 仅协调 `SinglePageWorkbench` 的现有三个画布页签，不改训练引擎和持久化。模型改变时应用默认页，训练开始时切到训练过程，完成状态只自动切换一次至结果；手动选页在普通重渲染后保持。

**技术栈：** React、TypeScript、Vitest、React Testing Library；真实浏览器视觉检查使用项目当前运行方式，不新增浏览器依赖或测试基础设施。

---

## 文件与职责

- `specs/039-workbench-canvas-stage-transitions.sdd.md`：默认阶段、自动转换和验收的唯一事实来源。
- `specs/037-workflow-reentry-and-canvas-layout.sdd.md`：保留既有重入/布局要求并引用 SDD-039；该交叉引用已在规格提交中完成。
- `src/features/workbench/SinglePageWorkbench.test.tsx`：页签选择与状态转换回归测试。
- `src/features/workbench/SinglePageWorkbench.tsx`：按模型默认阶段以及训练开始、完成、重置时的页签状态协调。

## 主线提交规则

每类行为的新增测试先在本地工作区运行并确认按预期失败，随后立即实现至该定向测试通过。**红测状态仅为本地临时状态，不得单独提交或留在 `main`；每个提交须包含测试和实现，并以相关定向测试通过作为提交前条件。** 两类行为分别形成绿态提交，最后再进行全项目验证和文档记录提交。

## Task 1：实现按模型选择默认阶段

**Files:**

- Modify: `src/features/workbench/SinglePageWorkbench.test.tsx`
- Modify: `src/features/workbench/SinglePageWorkbench.tsx`
- Test: `src/features/workbench/SinglePageWorkbench.test.tsx`

- [ ] **Step 1：补充默认阶段回归测试**

调整现有 `CNN 默认显示空训练画布，并可在独立页签编辑网络结构`：CNN 初始应选中“网络结构”且显示网络流；显式点选“训练过程”后再断言空训练画布。新增以下测试并断言对应 tab 的 `aria-selected="true"`：

1. `普通模型默认训练过程页签，CNN 默认网络结构页签`：普通模型默认训练过程，带有效图像尺寸的 CNN 默认网络结构。
2. `模型变化时切换默认页，同模型重渲染保留手动页`：非 CNN → CNN 选结构、CNN → 非 CNN 选训练；同一 CNN 手动切到训练后只修改 `params` 并 rerender，仍选训练。
3. `重置与重入按当前模型选择默认页`：CNN 重置和卸载后以 CNN props 重挂载都选结构；非 CNN 重置/重挂载仍选训练。

将原测试 `开始训练和重置训练时自动切回训练过程页签` 拆开：开始训练在 CNN 与非 CNN 下均选训练过程；重置按当前模型回到默认阶段。先仅添加测试，确认它们在当前实现上失败：

Run: `npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx`

Expected: FAIL，报告 CNN 初始/切换/重置未选中网络结构。此红测仅留在本地工作区，不提交。

- [ ] **Step 2：实现模型默认阶段、变化响应与重置行为**

在组件顶部新增模型默认页映射；在组件内以一个前值 ref 响应实际模型变化，保持相同模型的参数/状态更新不会重置手动页签。下面代码给出所需状态规则；可以按现有组件习惯调整组织方式，但验收语义不变：

```tsx
const defaultCanvasView = (model?: ModelKind): CanvasView =>
  model === 'visual-cnn' ? 'architecture' : 'training'

const [canvasView, setCanvasView] = useState<CanvasView>(() => defaultCanvasView(model))
const previousModel = useRef(model)

useEffect(() => {
  if (previousModel.current === model) return
  previousModel.current = model
  setCanvasView(defaultCanvasView(model))
}, [model])
```

相应地，`resetTraining` 先 `setCanvasView(defaultCanvasView(model))` 再调用 `onResetTraining?.()`；保留 `startTraining` 先选择 `training` 再调用 `onStartTraining()`。导入所需 React Hook；不要加入第三方状态库或改动布局 CSS。

- [ ] **Step 3：运行定向测试确认转绿**

Run: `npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx`

Expected: PASS，模型默认、模型切换、同模型手动选择保持、CNN/非 CNN 重置与重入、开始训练切回训练过程均通过。

- [ ] **Step 4：提交本类行为的绿态变更**

先再次运行 Step 3 的命令并确认退出码为 0，再提交测试和实现：

```powershell
git add src/features/workbench/SinglePageWorkbench.test.tsx src/features/workbench/SinglePageWorkbench.tsx
git commit -m "实现工作台按模型选择默认阶段"
```

## Task 2：实现完成时自动打开结果页

**Files:**

- Modify: `src/features/workbench/SinglePageWorkbench.test.tsx`
- Modify: `src/features/workbench/SinglePageWorkbench.tsx`
- Test: `src/features/workbench/SinglePageWorkbench.test.tsx`

- [ ] **Step 1：补充完成及其他终态测试**

新增 `训练完成后自动切到结果与解释` 和 `训练完成但保存失败仍自动切到结果与解释`：先以 `status="训练中…"` 渲染，再 `rerender` 为相应完成状态，断言结果 tab 被选中且结果面板出现本轮结果。随后手动切回训练页（CNN 也测试网络结构页），只修改 `datasetName` 或其他非模型/状态 prop 并 rerender，断言手动页仍选中。

以 `it.each` 覆盖 `训练失败`、`训练已停止`、`训练已取消`：从训练中开始，CNN 先手动选网络结构，再 rerender 到各终态；断言仍选网络结构且没有自动选结果。保留未完成时可以手动打开结果页并显示空态的既有覆盖。

更新现有直接以完成状态挂载、并假定默认在训练页的测试：`非迭代模型完成时展示拟合完成时间线`、`训练时间线紧凑展示快照并保留完整可访问名称`、`CNN 完成后训练图和结果分别位于对应页签`。它们应先验证完成默认进入结果，再显式点击“训练过程”查看时间线；不要删除其原有时间线断言。

先运行同一命令确认新增完成自动切换断言在旧逻辑上失败；此红测也只保留在本地，不能单独提交：

Run: `npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx`

Expected: 完成与保存失败用例未自动选择结果而 FAIL；失败/停止/取消上下文保持断言通过。

- [ ] **Step 2：实现完成状态边沿转换**

将下面状态协调片段合入 Task 1 的现有逻辑。示例用单个 `{ model, status }` 前值 ref 区分真实变化与普通重渲染；实现可延续组件现有 Hook 组织方式，但不得在每次 render 或每次非状态属性更新时重新选页。完成状态包括 `训练完成` 与 `训练完成，保存失败`：

```tsx
const isCompleteStatus = (status: string) =>
  status === '训练完成' || status === '训练完成，保存失败'

const [canvasView, setCanvasView] = useState<CanvasView>(() =>
  isCompleteStatus(status) ? 'results' : defaultCanvasView(model),
)
const previous = useRef({ model, status })

useEffect(() => {
  const modelChanged = previous.current.model !== model
  const statusChanged = previous.current.status !== status
  previous.current = { model, status }

  if (modelChanged) setCanvasView(defaultCanvasView(model))
  if (statusChanged && isCompleteStatus(status)) setCanvasView('results')
}, [model, status])
```

当模型与完成状态同时变化时，完成结果页优先。失败、停止、取消以及其他非完成状态不调用 `setCanvasView`；完成后的普通重渲染不会重新触发转换。开始训练仍显式选择训练过程，重置仍按当前模型选默认页。

- [ ] **Step 3：运行定向测试确认所有本类行为转绿**

Run: `npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx`

Expected: PASS，包含普通/CNN 默认阶段、完成及保存失败自动切结果、完成后手动选页保持、失败/停止/取消保持当前页、完成结果空态/时间线及键盘导航。

- [ ] **Step 4：提交本类行为的绿态变更**

先再次运行 Step 3 的命令并确认退出码为 0，再提交测试和实现：

```powershell
git add src/features/workbench/SinglePageWorkbench.test.tsx src/features/workbench/SinglePageWorkbench.tsx
git commit -m "训练完成后自动展示实验结果"
```

## Task 3：全量验证、真实浏览器走查并回写规格

**Files:**

- Modify: `specs/039-workbench-canvas-stage-transitions.sdd.md`
- Test: `src/features/workbench/SinglePageWorkbench.test.tsx`
- Browser: 当前工作台应用，使用已有真实浏览器；不新增测试框架或产品界面。

- [ ] **Step 1：运行定向测试、全量测试、构建与 lint**

```powershell
npm.cmd test -- src/features/workbench/SinglePageWorkbench.test.tsx
npm.cmd test
npm.cmd run build
npm.cmd run lint
git diff --check
```

Expected: 所有 Vitest 用例通过，TypeScript/Vite 构建成功，lint 成功，`git diff --check` 退出码为 0。若任一验证失败，先修复并重跑失败命令；不提交失败状态。

- [ ] **Step 2：在真实浏览器检查阶段与间距**

Run: `npm.cmd run dev -- --host 127.0.0.1`

Expected: Vite 输出本地访问地址（默认 `http://127.0.0.1:5173`）。在真实 Chrome 中分别使用 1366×768 与 390×844 视口，沿应用当前的数据准备流程选择内置“8×8 数字图像（0–9）”和可视化 CNN，进入工作台后确认网络结构页默认打开；点击“开始训练”并等到完成，确认过程页和结果页按时序自动切换。对每一视口核对配置栏、主画布、页签、网络/训练/结果卡片的实际边界与间距，确认控件/内容无裁切、叠压，间距层次舒适；390px 下确认 `document.documentElement.scrollWidth <= window.innerWidth`，纵向滚动允许但无横向溢出。

然后切到可用的表格数据与普通模型（如“月牙形”+逻辑回归），确认默认训练页和训练画布卡片排版正常。记录 1366×768 与 390×844 的实测关键卡片宽高、间距观察和横向溢出检查结果。若现有 CSS 通过且无需改动，在 SDD 实现记录中明确写“无需改 CSS，现有样式经两个视口下的真实浏览器视觉核对通过”；如发现本规格范围内的阶段布局问题，先更新 SDD 再修正，不得将未通过的核对标记为完成。

- [ ] **Step 3：更新 SDD 实现记录**

在 `specs/039-workbench-canvas-stage-transitions.sdd.md` 第 9 节将状态改为已完成，准确记录 Step 1 的实际命令及结果、真实浏览器两个视口的检查结果、是否改 CSS，以及任何已知限制。复核 SDD-037 交叉引用仍与验收一致；不得记录未运行的命令或未核实的视觉结果为通过。

- [ ] **Step 4：提交验证记录**

```powershell
git add specs/039-workbench-canvas-stage-transitions.sdd.md
git commit -m "记录工作台画布阶段转换验证结果"
```

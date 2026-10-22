# 模型与数据集合并选择实施计划

> **执行方式：**在当前会话按任务顺序实施；先写失败测试，再写最小实现。

**目标：**将模型和数据选择合并到“模型与数据”页，压缩模型选择控件并保留兼容筛选、预览和确认行为。

**架构：**App 将顶层准备流程收敛为一个 `setup` 页面。准备页在现有数据控制区顶部组合任务与模型选择，并复用 DatasetPanel 的数据选择、CSV 和预览；DatasetPanel 在外部模型切换导致数据变化时同步当前预览。

**技术栈：**React、TypeScript、CSS、Vitest、Testing Library、Playwright。

---

## 文件职责

- `src/features/workbench/pages.tsx`：提供合并后的准备页与紧凑模型选择器。
- `src/features/datasets/DatasetPanel.tsx`：提供模型控件插槽，并同步 App 传入的数据集变化。
- `src/features/workbench/HistoryPage.tsx`：将主导航模型/数据两个入口合并为 `setup`。
- `src/App.tsx`：以单个准备页替代两个页面路由，并保留训练、历史回调。
- `src/features/workbench/pages.css`：准备页模型控件尺寸与两栏/窄屏布局。
- `src/features/workbench/pages.test.tsx`、`src/features/datasets/DatasetPanel.test.tsx`、`src/features/workbench/HistoryPage.test.tsx`、`src/App.test.tsx`：验证准备页、同步逻辑、导航及主流程。
- `specs/034-merged-model-dataset-selection.sdd.md`：记录实现状态、验证命令和已知限制。

## 任务 1：先为合并准备页写失败测试

**文件：**`src/features/workbench/pages.test.tsx`

- [ ] 添加 `ExperimentSetupPage` 测试：页面同时包含“具体模型”“内置数据集”“数据集预览”和 CSV 上传；没有模型 radio 卡片；选中模型说明可见。
- [ ] 添加模型选择测试：选择“回归”任务后模型选择值更新为回归组首项，并调用 `onModelChange('linear-regression')`。
- [ ] 添加 CNN 测试：模型选择为 `visual-cnn` 时只显示图像数据集、不显示 CSV 上传。
- [ ] 运行 `npm test -- --run src/features/workbench/pages.test.tsx`，确认测试因 `ExperimentSetupPage` 不存在或行为缺失而失败。

测试断言示例：

```tsx
expect(screen.getByRole('heading', { name: '模型与数据' })).toBeInTheDocument()
expect(screen.getByRole('combobox', { name: '具体模型' })).toHaveValue('knn')
expect(screen.getByRole('combobox', { name: '内置数据集' })).toBeInTheDocument()
expect(screen.getByRole('heading', { name: '数据集预览' })).toBeInTheDocument()
expect(screen.queryByRole('radio', { name: 'KNN' })).not.toBeInTheDocument()
```

## 任务 2：实现紧凑模型选择器并嵌入数据控制区

**文件：**`src/features/workbench/pages.tsx`、`src/features/datasets/DatasetPanel.tsx`、`src/features/datasets/DatasetPanel.test.tsx`

- [ ] 在 DatasetPanel props 增加 `controlsBefore?: ReactNode`，并在数据来源标题前渲染该节点。
- [ ] 将 ModelPage 的任务分组行为收敛为受控模型选择器：任务按钮按当前模型任务选中，具体模型用 `<select aria-label="具体模型">`，只显示当前模型的简短说明；MLP 保留原适用提醒。
- [ ] 新增 `ExperimentSetupPage`，把模型选择器通过 `controlsBefore` 放进 DatasetPanel 左侧控制区，保留数据集确认回调和兼容筛选。
- [ ] 运行 `npm test -- --run src/features/workbench/pages.test.tsx src/features/datasets/DatasetPanel.test.tsx`，确认任务 1 及现有数据选择测试通过。

选择模型的实现形态：

```tsx
<label>具体模型<select aria-label="具体模型" value={value} onChange={event => onChange(event.target.value as ModelKind)}>
  {models.map(kind => <option key={kind} value={kind}>{modelInfo[kind].name}</option>)}
</select></label>
<p className="model-selection-description">{modelInfo[value].description}</p>
```

## 任务 3：测试并实现外部数据集同步

**文件：**`src/features/datasets/DatasetPanel.test.tsx`、`src/features/datasets/DatasetPanel.tsx`

- [ ] 添加 rerender 测试：从表格模型及表格数据切换到 CNN 和图像数据时，`dataset-summary` 与预览更新为传入的图像数据。
- [ ] 先运行 `npm test -- --run src/features/datasets/DatasetPanel.test.tsx`，确认现状因 DatasetPanel 仅在初始化读取 `initialDataset` 而失败。
- [ ] 使用依赖 `[initialDataset, model]` 的 effect 同步外部数据：优先使用与模型兼容的 `initialDataset`；传入数据不兼容时使用当前模型对应的默认内置数据。兼容切换应保留当前表格/CSV 数据。
- [ ] 重跑 DatasetPanel 测试，确认同步测试和 CSV 导入/中断测试通过。

## 任务 4：合并主导航和 App 页面路由

**文件：**`src/features/workbench/HistoryPage.test.tsx`、`src/features/workbench/HistoryPage.tsx`、`src/App.test.tsx`、`src/App.tsx`

- [ ] 更新导航测试：顶层导航只有“模型与数据、实验流程、历史记录”三项；准备页项的 `onPageChange` 值为 `setup`。
- [ ] 运行导航和 App 定向测试，确认旧导航与两页流程相关断言失败。
- [ ] 将 `TopLevelPage` 改为 `setup | workflow | history`，移除独立模型/数据页按钮和 `datasetDisabled`。
- [ ] App 初始页改为 `setup`；准备页接收 `activeModel`、`handleModelSelection`、现有数据及 CSV/确认回调。
- [ ] 确认有效数据后标记 `datasetConfirmed` 并进入 workflow；训练画布的更换数据集回调返回 `setup`。
- [ ] 更新 App 测试：模型切换后兼容数据筛选正确，确认后进入训练流程，更换数据返回合并页。
- [ ] 运行 `npm test -- --run src/features/workbench/HistoryPage.test.tsx src/App.test.tsx` 并修复本次引起的失败。

## 任务 5：准备页布局与窄屏回归

**文件：**`src/features/workbench/pages.css`、`src/features/workbench/pages.test.tsx`、必要时 `e2e/workbench.spec.ts`

- [ ] 在现有 `.dataset-workspace` 两栏网格中保持左侧控件、右侧预览；允许左侧控件区纵向滚动，确认按钮在控件区内可达。
- [ ] 为模型选择器增加紧凑间距和选中模型说明样式，不再为全量模型列表分配滚动高度。
- [ ] 窄屏继续使用单列顺序：准备标题、模型与数据控件、数据预览；检查控件区和预览区不发生横向溢出或裁切。
- [ ] 运行相关页面测试与现有 Playwright 主流程，覆盖至少桌面和窄屏视口。

## 任务 6：完整验证、规格回填与提交

**文件：**`specs/034-merged-model-dataset-selection.sdd.md` 及本计划涉及的实现文件。

- [ ] 运行受影响测试，再运行 `npm test -- --run`、`npm run lint`、`npm run build`、`git diff --check`；按结果修复。
- [ ] 在 SDD-034 写入实际实现状态、命令结果、浏览器验证和已知限制。
- [ ] 检查工作区变更，只暂存本次修改文件/补丁，保留开始时已有的 `App.tsx`、历史页、持久化和验收记录未提交改动。
- [ ] 在 `main` 上使用中文提交信息提交本次实现。

## 自查

- SDD-034 中的三项导航、同页选择、紧凑模型控件、模型兼容性、CSV 导入、确认状态、返回路径和响应式布局均对应任务 1–5。
- 页面与数据状态同步先有失败测试，后修改实现；任务 6 回填验证结果。
- 所有新接口名称保持一致：`ExperimentSetupPage`、`controlsBefore`、`TopLevelPage = 'setup' | 'workflow' | 'history'`。

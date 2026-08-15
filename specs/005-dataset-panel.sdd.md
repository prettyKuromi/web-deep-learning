# SDD-005：数据集选择面板

- 状态：Implemented
- 编号：005
- 创建日期：2026-08-08

## 1. 背景与目标

为工作台提供可直接操作的数据入口，让用户选择内置示例或导入 CSV，并将解析后的 `Dataset` 交给上层训练流程。

## 2. 范围

- 展示五种内置数据集并支持切换。
- 选择内置数据集时按固定默认参数生成数据并触发 `onDatasetChange`。
- 接受 `.csv` 文件，读取并解析二维数值特征与标签。
- CSV 解析失败时通过 `onError` 提供中文错误信息。
- 显示当前数据集名称、样本数和 CSV 跳过行数。

不包含：特征列映射、数据划分、标准化和训练控制。

## 3. API

```ts
interface DatasetPanelProps {
  onDatasetChange: (dataset: Dataset) => void
  onError?: (message: string) => void
}
```

## 4. 用户流程

用户打开面板后默认选中第一个内置数据集；切换选项立即生成并回调。上传 CSV 后异步读取，解析成功回调数据，失败显示错误并调用 `onError`。

## 5. 验收标准

- 内置数据集选项完整显示。
- 切换内置数据集会回调对应名称和有效样本。
- 合法 CSV 会回调解析结果与跳过行数提示。
- 非法或空 CSV 显示错误提示且不触发数据变更。
- 组件测试覆盖上述行为。

## 6. 测试与实现记录

- 测试命令：`npm run test -- src/features/datasets/DatasetPanel.test.tsx`
- 实现状态：已完成
- 已知限制：CSV 默认使用前两列为特征、最后一列为标签，列选择将在后续工作台功能中实现。

## 7. 布局优化（2026-08-15）

### 背景与目标

数据集页原先将页面标题置于双栏工作区上方，右侧预览卡片会被标题整体下推，形成不必要的顶部留白。标题只服务于左侧的数据集选择操作。

### 范围与用户流程

- 页面标题与数据集选择卡片同属左列，标题显示在卡片上方。
- 右侧数据集预览卡片从双栏工作区顶部开始，与左侧标题顶部对齐。
- 小屏幕保持单列顺序：标题、选择卡片、预览卡片。

不改变数据集选择、CSV 导入、预览数据或继续实验的业务行为。

### 技术方案

数据集页不再使用通用页面壳的顶层标题。将同样的 `page-heading` 作为 `dataset-workspace` 的左列子项；通过 Grid 行列定位让预览卡片跨越左列的标题和控制卡片两行。现有 `DatasetPanel` 继续以 `display: contents` 输出两张卡片，无需新增状态或 API。

### 数据结构/API

无变化。

### 验收标准

- `.page-heading` 位于 `.dataset-workspace` 内，且只占左列。
- `.dataset-preview` 从工作区顶部开始，不再由页面标题下推。
- 数据集控件、预览和继续按钮仍可访问。

### 测试策略

- 为数据集页面添加 DOM 结构测试，确认标题移入 `dataset-workspace`。
- 执行相关 Vitest 测试、`npm run lint` 与 `npm run build`。

### 未决问题

无。

### 实现状态与验证

- 实现状态：已完成。`DatasetPage` 将标题放入左列工作区；预览卡片跨两行并从工作区顶部对齐；小屏幕恢复为标题、控件、预览的单列顺序。
- 验证命令：`npm test -- --run src/features/workbench/pages.test.tsx src/features/datasets/DatasetPanel.test.tsx`、`npm run lint`、`npm run build`。

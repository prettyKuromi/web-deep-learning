# SDD-033 实施计划

## 目标

按 `033-workbench-navigation-and-visualization.sdd.md` 完成模型优先流程、固定视口与独立滚动区、训练画布/CNN 编辑、结果解释和历史记录交互。只实现 SDD 约定的范围，不扩展训练算法。

## 任务顺序

1. **模型筛选与数据集测试（RED）**：先为模型优先页、CNN/表格数据筛选、禁用态隐藏、64 维预览上限编写失败测试。
2. **数据能力与生成器**：增加可复现的 8×8 `shapes` 数据，并让 `DatasetPanel` 按模型过滤内置集合和 CSV 入口；让统计和样本行最多显示前 8 维。
3. **模型优先导航**：扩充 `TopLevelPage`、`TopLevelNavigation`，以 `ModelPage` 为初始选择；选择模型后按需切换兼容默认数据集，再进入过滤后的数据页；训练页只列当前数据兼容的任务和模型。
4. **CNN 网络画布（子代理）**：先测试网络节点内编辑激活/数值、前后插层、拖拽排序和结构错误，再实现 `NetworkFlowCanvas`；从训练页移除独立 `VisualNetworkBuilder`。
5. **训练与结果**：先测试无损失时的数据/结果可视化和指标说明，再把开始/训练控制移至配置栏，扩大训练画布和结果区并保持各自滚动；CNN 类数改为数据集实际标签数。
6. **历史记录交互**：先测试整卡选择、精确删除、标题工具栏和参数标签；随后改造 `HistoryPage` / `ResultsPage`，保留已存在的 JSON、Markdown、HTML 导出能力。
7. **整体布局与浏览器验收**：固定头部与 app 内容高度，调整数据页、工作流和历史页视口网格；运行自动测试与构建，再由另一个 Luna 子代理使用内置浏览器检查交互和滚动，修复发现的问题。
8. **规格回填与提交**：在 SDD 记录实际测试命令、浏览器验收情况和限制；审阅 diff，分别提交规格和实现，提交信息使用中文并留在 `main`。

## 目标文件

- `src/App.tsx`, `src/App.css`, `src/features/workbench/HistoryPage.tsx`
- `src/features/workbench/pages.tsx`, `src/features/workbench/pages.css`, `src/features/workbench/SinglePageWorkbench.tsx`, `src/features/workbench/SinglePageWorkbench.css`, `src/features/workbench/SinglePageWorkbench.layout.css`
- `src/features/datasets/dataset.ts`, `src/features/datasets/DatasetPanel.tsx`
- `src/features/training/NetworkFlowCanvas.tsx`, `NetworkFlowCanvas.css`，必要的组件测试；保留 `visualNetwork.ts` 结构校验接口
- `src/features/training/TrainingProgressChart.tsx`, `src/features/workbench/CurrentResultPanel.tsx`
- 对应的 `*.test.ts(x)` 与 `specs/033-workbench-navigation-and-visualization.sdd.md`

## 验证

先跑受影响的 Vitest 文件，再跑 `npm test`、`npm run build`；最终以浏览器子代理的实际页面检查确认固定视口布局、面板滚动、选择顺序、CNN 图层编辑、无损失可视化和历史交互。

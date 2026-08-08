# Neon Lab UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有机器学习工作台改造成深色 Neon Lab 科技感界面，同时保持现有训练和数据交互不变。

**Architecture:** 保留 React 状态与算法调用，仅重排 `App.tsx` 的语义布局；用 `index.css` 定义全局主题变量，用 `App.css` 定义工作台、流程栏、控制面板、结果面板和响应式样式。所有样式使用原生 CSS，不新增依赖。

**Tech Stack:** React、TypeScript、Vite、原生 CSS、Vitest。

---

### Task 1: 更新工作台语义结构

**Files:**
- Modify: `src/App.tsx`

- [ ] 将顶部 header 增加 `brand-mark`、实验编号和 `header-meta`，保留现有标题及状态 badge。
- [ ] 将阶段导航从横向按钮改为 `workflow-rail`，每个按钮包含编号、阶段名和 `stage-caption`，继续使用 `activeStage` 与 `setActiveStage`。
- [ ] 给左侧控制区和右侧结果区增加 `panel-kicker`、`control-stack`、`results-header`、`metrics-strip` 等语义 className，不修改事件处理和训练 API。
- [ ] 运行 `npm run test -- --run src/App.test.tsx`，确认结构改动不破坏现有行为。

### Task 2: 建立 Neon Lab 全局主题

**Files:**
- Modify: `src/index.css`

- [ ] 增加深色主题变量（`--bg-ink`、`--panel`、`--line`、`--cyan`、`--muted`），设置全局字体、背景、文本颜色和选中颜色。
- [ ] 为 body 增加固定背景渐变和细网格背景，确保内容层级在背景之上。
- [ ] 增加全局 `:focus-visible` 样式，确保键盘操作可见。

### Task 3: 实现工作台视觉和响应式样式

**Files:**
- Modify: `src/App.css`

- [ ] 重写 shell/header/workflow rail 样式：最大宽度 1280px、顶部实验室栏、青色状态指示和四阶段纵向导航。
- [ ] 重写面板样式：深色半透明背景、蓝灰边框、内发光、圆角和紧凑间距；为输入、select、上传控件和训练按钮提供 hover/focus/disabled 状态。
- [ ] 为 chart/result 区增加主图视觉、样本计数、指标摘要和状态色，保留现有图表 canvas 尺寸行为。
- [ ] 增加 900px 与 640px 断点：中等宽度收窄侧栏，窄屏改为单列并允许阶段导航横向滚动。

### Task 4: 回归验证并更新 SDD

**Files:**
- Modify: `specs/007-neon-lab-ui.sdd.md`

- [ ] 运行 `npm run test -- --run`。
- [ ] 运行 `npm run build`。
- [ ] 更新 SDD 的实现状态、验证命令和已知限制。
- [ ] 检查 `git diff --check`，确认无空白错误。

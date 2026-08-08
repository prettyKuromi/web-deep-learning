# SDD-002：数据集管理

- 状态：Implemented
- 编号：002
- 创建日期：2026-08-08

## 1. 背景与目标

为 MVP 提供可复现的二维监督分类数据：内置演示数据集和 CSV 导入，并在训练前完成基础校验与清洗。

## 2. 范围

### 包含

- 线性可分、XOR、月牙形、环形、随机簇五种内置数据集。
- 使用 seed 保证内置数据生成确定性。
- CSV 首行作为表头，选择两个数值特征和一个非空标签列。
- 自动跳过缺失、非法数值或空标签行，并报告跳过数量。
- 校验二维特征、特征标签长度一致且至少包含两个类别。

### 不包含

- 类别特征编码、自动标准化、回归数据、超过二维的可视化特征。

## 3. 用户流程

选择内置数据集或粘贴/上传 CSV → 解析并清洗 → 预览有效行与跳过行数量 → 校验通过后交给训练模块。

## 4. 技术方案

在 `src/features/datasets/dataset.ts` 中实现纯 TypeScript 数据生成、校验和 Papa Parse CSV 适配。数据结构使用二维元组 `FeatureVector` 与字符串/数字标签数组。

## 5. 数据结构与接口

```ts
interface Dataset { features: [number, number][]; labels: Array<string | number>; name?: string }
generateBuiltinDataset(id, options): Dataset
parseCsvDataset(csv, options): { dataset: Dataset; skippedRows: number; columns: string[] }
validateDataset(dataset): { valid: boolean; errors: string[] }
```

## 6. 错误处理

CSV 无有效行时抛出包含“至少需要一行有效数据”的错误；字段非法行被跳过并计数；结构校验错误返回中文错误列表。

## 7. 验收标准

- 五种内置数据集可生成，固定 seed 输出一致。
- CSV 可提取两个数值特征和标签，非法行不进入结果且计数正确。
- 空数据、维度错误、长度不一致、单一类别均被拒绝。

## 8. 测试策略

Vitest 覆盖内置数据确定性、数据集种类、CSV 清洗与错误、二维结构和类别校验。

## 9. 实现记录

- 实现状态：已完成
- 验证命令：`npm test -- src/features/datasets/dataset.test.ts`（6 passed）
- 已知限制：当前 CSV API 接收字符串，文件读取和 UI 字段选择由后续工作台功能实现。

## 10. 未决问题

- 是否在后续阶段加入自动标准化与训练/测试划分。

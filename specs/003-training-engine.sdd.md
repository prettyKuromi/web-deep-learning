# SDD-003：训练引擎基础接口

- 状态：Implemented
- 版本：1.0

## 背景与目标

为浏览器端经典机器学习算法提供统一、可测试的训练与预测接口。第一版先覆盖 KNN，后续逻辑回归和线性 SVM 复用同一契约。

## 范围

- `Trainer` 的 `train` 与 `predict` 方法。
- 训练配置、模型状态、训练快照和分类指标类型。
- 训练快照回调，用于 UI 实时更新。
- 分类指标：Accuracy、宏平均 Precision、Recall、F1、混淆矩阵。

## API

```ts
interface Trainer<C, M, P = Labels> {
  train(config: C, emit?: (snapshot: TrainSnapshot) => void): Promise<{
    model: M
    snapshots: TrainSnapshot[]
  }>
  predict(model: M, samples: FeatureMatrix): P
}
```

训练输入限定为二维数值特征矩阵和分类标签。指标函数要求真实标签与预测标签长度一致。

## 验收标准

- Trainer 实例暴露 train/predict 方法。
- 训练返回可序列化模型和快照。
- 非法输入返回可读错误。
- 指标结果包含四项标量、标签顺序和混淆矩阵。

## 测试与验证

- `npm test -- src/features/training/__tests__/training.test.ts`
- 结果：4 tests passed。

## 已知限制

- 当前训练在调用方线程执行；Worker 适配留待训练控制功能实现。
- 仅实现 KNN，迭代型模型将在后续 SDD 中增加。

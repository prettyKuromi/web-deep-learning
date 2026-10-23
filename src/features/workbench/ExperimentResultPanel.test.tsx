import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { ExperimentRecord } from '../../app/workbenchTypes'
import { ExperimentResultPanel } from './ExperimentResultPanel'

afterEach(cleanup)

function regressionRecord(overrides: Partial<ExperimentRecord> = {}): ExperimentRecord {
  return {
    id: 'regression-test',
    createdAt: 0,
    dataset: { features: [[0], [1]], labels: [10, 20] },
    modelKind: 'linear-regression',
    config: {},
    snapshots: [],
    predictions: [0, 0],
    ...overrides,
  }
}

function displayedMetric(label: string) {
  return screen.getByText(label).previousElementSibling
}

it('使用评估记录中的训练集指标，而不把全量误差显示成训练误差', () => {
  render(<ExperimentResultPanel record={regressionRecord({
    evaluation: {
      config: { enabled: true, validationSplit: 0.5, seed: 42 },
      trainSampleCount: 1,
      validationSampleCount: 1,
      trainMetrics: { mae: 1.25, mse: 2.5, r2: 0.75 },
    },
  })} />)

  expect(displayedMetric('平均绝对误差（MAE）')).toHaveTextContent('1.2500')
  expect(displayedMetric('均方误差（MSE）')).toHaveTextContent('2.5000')
  expect(displayedMetric('决定系数（R²）')).toHaveTextContent('0.7500')
  expect(screen.queryByText('15.0000')).not.toBeInTheDocument()
})

it('标明评估划分结果中的样例来自全量数据', () => {
  render(<ExperimentResultPanel record={regressionRecord({ evaluation: { config: { enabled: true, validationSplit: 0.5, seed: 42 }, trainSampleCount: 1, validationSampleCount: 1, trainMetrics: { mae: 1.25, mse: 2.5, r2: 0.75 } } })} />)

  expect(screen.getByText('全量数据预测样例（包含训练集与验证集）')).toBeInTheDocument()
})

it('单独展示已保存的验证集指标', () => {
  render(<ExperimentResultPanel record={regressionRecord({
    evaluation: {
      config: { enabled: true, validationSplit: 0.5, seed: 42 },
      trainSampleCount: 1,
      validationSampleCount: 1,
      trainMetrics: { mae: 1.25, mse: 2.5, r2: 0.75 },
      validationMetrics: { mae: 3.5, mse: 12.25, r2: -0.2 },
    },
  })} />)

  expect(screen.getByText('验证集 MAE 3.5000 · MSE 12.2500 · R² -0.2000')).toBeInTheDocument()
})

it('未启用评估时继续按全量训练数据计算指标', () => {
  render(<ExperimentResultPanel record={regressionRecord()} />)

  expect(displayedMetric('平均绝对误差（MAE）')).toHaveTextContent('15.0000')
  expect(displayedMetric('均方误差（MSE）')).toHaveTextContent('250.0000')
})

it('旧评估记录缺少训练指标时显示未记录，不回退全量误差', () => {
  render(<ExperimentResultPanel record={regressionRecord({
    evaluation: {
      config: { enabled: true, validationSplit: 0.5, seed: 42 },
      trainSampleCount: 1,
      validationSampleCount: 1,
      validationMetrics: { mae: 3.5, mse: 12.25, r2: -0.2 },
    },
  })} />)

  expect(screen.getByText('训练集指标未记录')).toBeInTheDocument()
  expect(screen.queryByText('15.0000')).not.toBeInTheDocument()
  expect(screen.queryByText('250.0000')).not.toBeInTheDocument()
})

it('evaluation 存在但未启用时按全量数据计算且不显示数据划分摘要', () => {
  render(<ExperimentResultPanel record={regressionRecord({
    evaluation: {
      config: { enabled: false, validationSplit: 0.5, seed: 42 },
      trainSampleCount: 1,
      validationSampleCount: 1,
      trainMetrics: { mae: 1.25, mse: 2.5, r2: 0.75 },
      validationMetrics: { mae: 3.5, mse: 12.25, r2: -0.2 },
    },
  })} />)

  expect(displayedMetric('平均绝对误差（MAE）')).toHaveTextContent('15.0000')
  expect(screen.queryByRole('region', { name: '训练与验证集评估' })).not.toBeInTheDocument()
})

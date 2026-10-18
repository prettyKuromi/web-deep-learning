import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PredictionPlayground } from './PredictionPlayground'

afterEach(cleanup)

const dataset = { features: [[0, 2], [2, 4]], labels: ['a', 'b'] }

it('均值初始化，输入改变后调用模型真实预测并标记回归值', () => {
  const predict = vi.fn(([first, second]: readonly number[]) => first + second)
  render(<PredictionPlayground dataset={dataset} predict={predict} task="regression" modelName="线性回归" />)
  expect(screen.getByLabelText('特征 1')).toHaveValue('1')
  expect(screen.getByLabelText('特征 2')).toHaveValue('3')
  fireEvent.change(screen.getByLabelText('特征 1'), { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: '运行预测' }))
  expect(predict).toHaveBeenCalledWith([5, 3])
  expect(screen.getByText('8')).toBeInTheDocument()
  expect(screen.getByText('模型：线性回归')).toBeInTheDocument()
})

it('拒绝无效输入、显示模型错误，并能恢复均值和清除旧预测', () => {
  const predict = vi.fn(() => { throw new Error('输入维度不匹配') })
  render(<PredictionPlayground dataset={dataset} predict={predict} task="classification" />)
  fireEvent.change(screen.getByLabelText('特征 2'), { target: { value: 'abc' } })
  fireEvent.click(screen.getByRole('button', { name: '运行预测' }))
  expect(screen.getByRole('alert')).toHaveTextContent('特征 2 必须是有效数字')
  expect(predict).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('特征 2'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: '运行预测' }))
  expect(screen.getByRole('alert')).toHaveTextContent('输入维度不匹配')
  fireEvent.click(screen.getByRole('button', { name: '恢复均值' }))
  expect(screen.getByLabelText('特征 2')).toHaveValue('3')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

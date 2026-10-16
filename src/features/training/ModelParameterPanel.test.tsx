import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModelParameterPanel } from './ModelParameterPanel'

describe('ModelParameterPanel', () => {
  afterEach(() => cleanup())

  it('按模型显示对应的中文参数输入项', () => {
    const { rerender } = render(<ModelParameterPanel model="knn" value={{ k: 5 }} onChange={vi.fn()} />)
    expect(screen.getByLabelText('邻居数（k）')).toBeInTheDocument()
    expect(screen.queryByLabelText('学习率')).not.toBeInTheDocument()

    rerender(<ModelParameterPanel model="logistic-regression" value={{ learningRate: 0.1, iterations: 100, regularization: 0 }} onChange={vi.fn()} />)
    expect(screen.getByLabelText('学习率')).toBeInTheDocument()
    expect(screen.getByLabelText('迭代次数')).toBeInTheDocument()
    expect(screen.getByLabelText('正则化强度')).toBeInTheDocument()
  })

  it('输入合法参数时回传合并后的参数', () => {
    const onChange = vi.fn()
    render(<ModelParameterPanel model="knn" value={{ k: 5, other: 1 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('邻居数（k）'), { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith({ k: 7, other: 1 })
  })

  it('为参数提供科技感滑动条并同步当前值', () => {
    const onChange = vi.fn()
    render(<ModelParameterPanel model="knn" value={{ k: 5 }} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: '邻居数（k）滑动调节' })
    fireEvent.change(slider, { target: { value: '8' } })
    expect(onChange).toHaveBeenCalledWith({ k: 8 })
  })

  it('支持直接输入特定参数值', () => {
    const onChange = vi.fn()
    render(<ModelParameterPanel model="knn" value={{ k: 5 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('邻居数（k）'), { target: { value: '12' } })
    expect(onChange).toHaveBeenCalledWith({ k: 12 })
  })

  it('超出范围或格式错误时显示提示且不回传', () => {
    const onChange = vi.fn()
    render(<ModelParameterPanel model="knn" value={{ k: 5 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('邻居数（k）'), { target: { value: '0' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('邻居数（k）应为 1 到 99 的整数')
  })

  it('逻辑回归和线性 SVM 参数使用紧凑网格布局', () => {
    const { rerender } = render(
      <ModelParameterPanel
        model="logistic-regression"
        value={{ learningRate: 0.1, iterations: 100, regularization: 0 }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('model-parameter-grid')).toHaveClass('model-parameter-grid--compact')
    expect(screen.getAllByTestId('model-parameter-row')).toHaveLength(3)

    rerender(
      <ModelParameterPanel
        model="linear-svm"
        value={{ learningRate: 0.01, iterations: 100, regularization: 0, margin: 1 }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('model-parameter-grid')).toHaveClass('model-parameter-grid--compact')
    expect(screen.getAllByTestId('model-parameter-row')).toHaveLength(4)
  })

  it('MLP 显示深度学习参数并给出适用性提醒', () => {
    render(<ModelParameterPanel model="mlp" value={{ learningRate: 0.01, epochs: 100, batchSize: 32, hiddenLayers: 2, hiddenUnits: 16 }} onChange={vi.fn()} />)
    expect(screen.getByLabelText('学习率')).toBeInTheDocument()
    expect(screen.getByLabelText('训练轮数')).toBeInTheDocument()
    expect(screen.getByLabelText('批大小')).toBeInTheDocument()
    expect(screen.getByLabelText('隐藏层数')).toBeInTheDocument()
    expect(screen.getByLabelText('每层神经元数')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('MLP 仅适合数值特征')
  })
})

it('允许清空输入并报告无效草稿，不把空值转换成零', () => {
  const onChange = vi.fn(); const onValidityChange = vi.fn()
  render(<ModelParameterPanel model="knn" value={{k: 5}} onChange={onChange} onValidityChange={onValidityChange} />)
  fireEvent.change(screen.getByLabelText('邻居数（k）'), {target: {value: ''}})
  expect(screen.getByLabelText('邻居数（k）')).toHaveValue(null)
  expect(onChange).not.toHaveBeenCalled()
  expect(onValidityChange).toHaveBeenLastCalledWith(false)
  expect(screen.getByRole('alert')).toHaveTextContent('不能为空')
})

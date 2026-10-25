import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelKind } from '../../app/workbenchTypes'
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

  it('在关键模型参数旁显示简释并通过 aria-describedby 关联输入控件', () => {
    const { rerender } = render(<ModelParameterPanel model="knn" value={{ k: 5 }} onChange={vi.fn()} />)
    const cases: Array<{ model: ModelKind; value: Record<string, number>; label: string; description: string }> = [
      { model: 'knn' as const, value: { k: 5 }, label: '邻居数（k）', description: '较小的 k 更敏感，较大的 k 更平滑。' },
      { model: 'logistic-regression' as const, value: { learningRate: 0.1, iterations: 100, regularization: 0.001 }, label: '学习率', description: '每次参数更新的步长。' },
      { model: 'logistic-regression' as const, value: { learningRate: 0.1, iterations: 100, regularization: 0.001 }, label: '迭代次数', description: '模型更新参数的总次数。' },
      { model: 'logistic-regression' as const, value: { learningRate: 0.1, iterations: 100, regularization: 0.001 }, label: '正则化强度', description: '限制过大的模型权重，减轻过拟合。' },
      { model: 'k-means' as const, value: { k: 3, iterations: 100, seed: 42 }, label: '簇数量（k）', description: '希望把数据划分成的组数。' },
      { model: 'dbscan' as const, value: { epsilon: 0.3, minPoints: 5 }, label: '邻域半径', description: '判断两个样本是否邻近的最大距离。' },
      { model: 'dbscan' as const, value: { epsilon: 0.3, minPoints: 5 }, label: '最小样本数', description: '邻域内达到此数量时，样本可成为核心点。' },
      { model: 'pca' as const, value: { components: 2 }, label: '主成分数量', description: '投影后保留的维度数。' },
      { model: 'mlp' as const, value: { learningRate: 0.01, epochs: 100, batchSize: 32, hiddenLayerCount: 2, hiddenUnits: 16 }, label: '批大小', description: '每次更新参数时使用的样本数。' },
      { model: 'mlp' as const, value: { learningRate: 0.01, epochs: 100, batchSize: 32, hiddenLayerCount: 2, hiddenUnits: 16 }, label: '隐藏层数', description: '输入与输出层之间的神经网络层数。' },
    ]

    for (const item of cases) {
      rerender(<ModelParameterPanel model={item.model} value={item.value} onChange={vi.fn()} />)
      const input = screen.getByLabelText(item.label)
      const description = screen.getByText(item.description)
      expect(description).toBeVisible()
      expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(description.id)
    }
  })

  it('KNN 模型原理和 k 参数影响提供互补说明', () => {
    render(<ModelParameterPanel model="knn" value={{ k: 5 }} onChange={vi.fn()} />)
    const modelHelp = screen.getByText(/根据最近邻居的类别投票决定预测结果/)
    const parameterHelp = screen.getByText('较小的 k 更敏感，较大的 k 更平滑。')

    expect(modelHelp).toBeVisible()
    expect(modelHelp).not.toHaveTextContent('更敏感')
    expect(parameterHelp).toBeVisible()
  })

  it('Transformer 显示模型参数并提示维度与注意力头数不匹配', () => {
    const onValidityChange = vi.fn()
    const { rerender } = render(<ModelParameterPanel model="transformer" value={{ modelDimension: 8, attentionHeads: 2 }} onChange={vi.fn()} onValidityChange={onValidityChange} />)
    expect(screen.getByLabelText('模型维度')).toBeInTheDocument()
    expect(screen.getByLabelText('注意力头数')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('注意力头数'), { target: { value: '3' } })
    expect(onValidityChange).toHaveBeenLastCalledWith(false)

    rerender(<ModelParameterPanel model="transformer" value={{ modelDimension: 8, attentionHeads: 3 }} onChange={vi.fn()} onValidityChange={onValidityChange} />)
    expect(screen.getByRole('alert')).toHaveTextContent('模型维度必须能被注意力头数整除')
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

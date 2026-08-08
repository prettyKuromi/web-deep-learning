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

  it('超出范围或格式错误时显示提示且不回传', () => {
    const onChange = vi.fn()
    render(<ModelParameterPanel model="knn" value={{ k: 5 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('邻居数（k）'), { target: { value: '0' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('邻居数（k）应为 1 到 99 的整数')
  })
})

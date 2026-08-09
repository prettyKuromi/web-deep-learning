import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainSnapshot } from '../training/types'
import { ModelExplanationPanel } from './ModelExplanationPanel'

describe('ModelExplanationPanel', () => {
  afterEach(() => cleanup())

  it('展示 MLP 层结构、激活函数和权重摘要', () => {
    render(<ModelExplanationPanel kind="mlp" model={{ layers: [2, 4, 2], activation: 'tanh', weights: [[[1, 2]], [[3, 4]]] }} />)
    expect(screen.getByRole('heading', { name: /多层感知机/i })).toBeInTheDocument()
    expect(screen.getByText(/2.*4.*2/)).toBeInTheDocument()
    expect(screen.getAllByText(/tanh/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/权重/i).length).toBeGreaterThan(0)
  })

  it('展示线性模型权重与 SVM 间隔说明', () => {
    render(<ModelExplanationPanel kind="linear-svm" model={{ weights: [[0.5, 1, -1]], dimensions: 2 }} />)
    expect(screen.getByText(/权重/i)).toBeInTheDocument()
    expect(screen.getAllByText(/间隔|hinge/i).length).toBeGreaterThan(0)
  })

  it('展示树结构和集成贡献', () => {
    render(<ModelExplanationPanel kind="decision-tree" model={{ dimensions: 2, root: { prediction: 'A', feature: 0, threshold: 0.4, left: { prediction: 'A' }, right: { prediction: 'B' } } }} />)
    expect(screen.getAllByText(/特征 1/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/叶节点/).length).toBeGreaterThan(0)

    render(<ModelExplanationPanel kind="random-forest" model={{ trees: [{ root: { prediction: 'A' } }, { root: { prediction: 'B' } }] }} />)
    expect(screen.getByText(/树数量/)).toBeInTheDocument()
    expect(screen.getAllByText(/2/).length).toBeGreaterThan(0)
  })

  it('支持从训练快照选择步骤并提示高维投影', async () => {
    const snapshots: TrainSnapshot[] = [{ iteration: 1, step: 1, loss: 1 }, { iteration: 2, step: 2, loss: 0.5 }]
    const onStepChange = vi.fn()
    render(<ModelExplanationPanel kind="knn" snapshots={snapshots} selectedStep={2} onStepChange={onStepChange} dimensions={3} />)
    expect(screen.getByRole('combobox', { name: /训练步骤/i })).toHaveValue('2')
    expect(screen.getByText(/前两个特征/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /训练损失曲线/i })).toBeInTheDocument()
  })
})

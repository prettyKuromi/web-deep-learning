import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatasetPanel } from './DatasetPanel'

describe('DatasetPanel', () => {
  afterEach(() => cleanup())
  it('显示全部内置数据集', () => {
    render(<DatasetPanel onDatasetChange={vi.fn()} />)

    expect(screen.getByRole('option', { name: '线性可分' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'XOR' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '月牙形' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '环形' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '随机簇' })).toBeInTheDocument()
  })

  it('按已选模型只显示兼容数据集，CNN 不提供表格 CSV 上传', () => {
    render(<DatasetPanel model="visual-cnn" onDatasetChange={vi.fn()} />)

    expect(screen.getByRole('option', { name: '8×8 数字图像（0–9）' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '8×8 图形图像（5 类）' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '线性可分' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('上传 CSV')).not.toBeInTheDocument()
  })

  it('64 维图像预览只展示前八维并注明截取范围', () => {
    const imageDataset = { name: '8×8 数字图像（0–9）', features: [Array(64).fill(0), Array(64).fill(1)], labels: [0, 1], dataType: 'image' as const, imageShape: { width: 8, height: 8, channels: 1 } }
    render(<DatasetPanel model="visual-cnn" initialDataset={imageDataset} onDatasetChange={vi.fn()} />)

    expect(screen.getByText('仅展示前 8 维，共 64 维')).toBeInTheDocument()
    expect(document.querySelectorAll('.dataset-preview-grid > div:nth-child(2) li')).toHaveLength(8)
    expect(screen.getAllByRole('table')[0]).toHaveAccessibleName('前 2 条有效样本')
    expect(screen.getAllByRole('table')[0].querySelectorAll('th')).toHaveLength(10)
  })

  it('默认展示内置数据集的预览、规模和特点说明', () => {
    render(<DatasetPanel onDatasetChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '数据集预览' })).toBeInTheDocument()
    expect(screen.getByText('样本量')).toBeInTheDocument()
    expect(screen.getByText('特征数')).toBeInTheDocument()
    expect(screen.getByText('标签数')).toBeInTheDocument()
    expect(screen.getByText(/默认约 200 条二维二分类样本/)).toBeInTheDocument()
    expect(screen.getByText(/线性边界/)).toBeInTheDocument()
  })

  it('选择内置数据集后回调数据', async () => {
    const user = userEvent.setup()
    const onDatasetChange = vi.fn()
    render(<DatasetPanel onDatasetChange={onDatasetChange} />)

    await user.selectOptions(screen.getByRole('combobox', { name: '内置数据集' }), 'xor')

    expect(onDatasetChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'XOR' }))
    expect(onDatasetChange.mock.calls[0][0].features.length).toBeGreaterThan(0)
  })

  it('解析 CSV 文件后回调数据并提示跳过行数', async () => {
    const user = userEvent.setup()
    const onDatasetChange = vi.fn()
    render(<DatasetPanel onDatasetChange={onDatasetChange} />)
    const file = new File(['x,y,label\n1,2,A\n3,4,B\ninvalid,5,A'], 'sample.csv', { type: 'text/csv' })

    await user.upload(screen.getByLabelText('上传 CSV'), file)

    await waitFor(() => expect(onDatasetChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'CSV 数据集' })))
    expect(screen.getByText(/跳过 1 行/)).toBeInTheDocument()
    expect(screen.getByText('A：1')).toBeInTheDocument()
    expect(screen.getByText('B：1')).toBeInTheDocument()
    expect(screen.getByText('前 2 条有效样本')).toBeInTheDocument()
  })

  it('支持将 CSV 拖入上传区导入', async () => {
    const onDatasetChange = vi.fn()
    render(<DatasetPanel onDatasetChange={onDatasetChange} />)
    const file = new File(['x,y,label\n1,2,A\n3,4,B'], 'dropped.csv', { type: 'text/csv' })
    const dropzone = screen.getByRole('button', { name: /拖拽 CSV 文件到此处/ })

    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [file] } })
    expect(dropzone).toHaveClass('is-dragging')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(onDatasetChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'CSV 数据集' })))
    expect(dropzone).not.toHaveClass('is-dragging')
  })

  it('CSV 无有效数据时显示错误并通知上层', async () => {
    const user = userEvent.setup()
    const onError = vi.fn()
    render(<DatasetPanel onDatasetChange={vi.fn()} onError={onError} />)
    const file = new File(['x,y,label\nnope,,'], 'bad.csv', { type: 'text/csv' })

    await user.upload(screen.getByLabelText('上传 CSV'), file)

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(screen.getByRole('alert')).toHaveTextContent('至少需要一行有效数据')
  })

  it('高维或样本偏少数据展示适用性提醒', async () => {
    const user = userEvent.setup()
    render(<DatasetPanel onDatasetChange={vi.fn()} />)
    const file = new File([
      'f1,f2,f3,f4,label\n1,100,0.1,5,A\n2,200,0.2,6,A\n3,300,0.3,7,A\n4,400,0.4,8,B',
    ], 'high-dimensional.csv', { type: 'text/csv' })

    await user.upload(screen.getByLabelText('上传 CSV'), file)

    await waitFor(() => expect(screen.getByText(/高维数据的二维投影仅用于观察/)).toBeInTheDocument())
    expect(screen.getByText(/样本量较少/)).toBeInTheDocument()
  })

  it('数值预览最多四位小数并保留完整值', () => {
    render(<DatasetPanel initialDataset={{ name: 'CSV 数据集', features: [[1.123456789, 2], [3, 4]], labels: ['A', 'B'] }} onDatasetChange={vi.fn()} />)
    expect(screen.getByRole('cell', { name: '1.1235' })).toHaveAttribute('title', '1.123456789')
    expect(screen.getAllByTitle('1.123456789')).toHaveLength(2)
    expect(screen.getByLabelText('内置数据集')).toHaveValue('csv')
  })

  it('解析中卸载会通知中断，迟到的文件结果不覆盖已离开的页面', async () => {
    const user = userEvent.setup()
    const onDatasetChange = vi.fn()
    const onImportStateChange = vi.fn()
    let resolveText!: (value: string) => void
    const file = new File([''], 'pending.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: () => new Promise<string>((resolve) => { resolveText = resolve }) })
    const { unmount } = render(<DatasetPanel onDatasetChange={onDatasetChange} onImportStateChange={onImportStateChange} />)
    await user.upload(screen.getByLabelText('上传 CSV'), file)
    expect(screen.getByRole('status')).toHaveTextContent('正在读取 CSV')
    unmount()
    expect(onImportStateChange).toHaveBeenLastCalledWith({ pending: false, error: 'CSV 导入已中断，请重新导入或选择内置数据集。' })
    resolveText('x,y,label\n1,2,A\n3,4,B')
    await waitFor(() => expect(onDatasetChange).not.toHaveBeenCalled())
  })
})

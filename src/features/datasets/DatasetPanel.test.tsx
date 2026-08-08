import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
})

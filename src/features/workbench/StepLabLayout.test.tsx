import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkbenchStage } from '../../app/workbenchTypes'
import { StepLabLayout, type ExperimentSummary, type StageProgress } from './StepLabLayout'

afterEach(() => cleanup())

const stages: WorkbenchStage[] = ['数据集', '模型', '训练', '结果']
const progress: StageProgress = { 数据集: 'completed', 模型: 'active', 训练: 'pending', 结果: 'blocked' }
const summary: ExperimentSummary = { datasetName: '月牙形', sampleCount: 120, classCount: 2, modelName: 'KNN', trainingStatus: '等待训练' }

describe('StepLabLayout', () => {
  it('renders three regions, current content and experiment summary', () => {
    render(<StepLabLayout activeStage="模型" stages={stages} stageProgress={progress} summary={summary} onStageChange={vi.fn()}><div>模型配置内容</div></StepLabLayout>)
    expect(screen.getByRole('navigation', { name: '实验阶段' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('模型配置内容')
    expect(screen.getByRole('complementary', { name: '实验摘要' })).toHaveTextContent('月牙形')
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveClass('step-lab-main')
    expect(screen.getByTestId('step-lab-scroll')).toHaveClass('step-lab-content')
    expect(screen.getByTestId('step-lab-viewport')).toHaveAttribute('data-scroll-policy', 'fixed-shell')
    expect(screen.getByTestId('step-lab-scroll')).toHaveAttribute('data-scroll-container', 'main')
  })

  it('changes stage from rail and navigates with previous/next actions', async () => {
    const user = userEvent.setup()
    const onStageChange = vi.fn()
    render(<StepLabLayout activeStage="模型" stages={stages} stageProgress={progress} summary={summary} onStageChange={onStageChange}><div /></StepLabLayout>)
    await user.click(screen.getByRole('tab', { name: /数据集/ }))
    expect(onStageChange).toHaveBeenCalledWith('数据集')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(onStageChange).toHaveBeenCalledWith('训练')
    await user.click(screen.getByRole('button', { name: '上一步' }))
    expect(onStageChange).toHaveBeenCalledWith('数据集')
  })

  it('disables blocked stages and edge navigation buttons', () => {
    render(<StepLabLayout activeStage="模型" stages={stages} stageProgress={progress} summary={summary} onStageChange={vi.fn()}><div /></StepLabLayout>)
    expect(screen.getByRole('tab', { name: /结果/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '上一步' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '下一步' })).not.toBeDisabled()
  })

  it('does not render next action when training is the last workflow stage', () => {
    render(<StepLabLayout activeStage={'璁粌' as WorkbenchStage} stages={['鏁版嵁闆?', '妯″瀷', '璁粌'] as unknown as WorkbenchStage[]} summary={summary} onStageChange={vi.fn()}><div /></StepLabLayout>)
    expect(screen.getByRole('main').querySelectorAll('footer button')).toHaveLength(1)
  })
})

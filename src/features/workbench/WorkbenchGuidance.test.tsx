import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuidanceContext } from './guidanceContent'
import { GUIDANCE_HINT_IDS } from './guidancePreferences'
import { WorkbenchGuidance } from './WorkbenchGuidance'

afterEach(() => cleanup())

const context = (page: GuidanceContext['page'], canvasView: GuidanceContext['canvasView'] = 'training'): GuidanceContext => ({
  page,
  canvasView,
  task: 'classification',
  model: 'logistic-regression',
})

describe('WorkbenchGuidance', () => {
  it.each([
    ['setup', '先选择要解决的任务和模型', GUIDANCE_HINT_IDS.setup],
    ['workflow', '配置模型参数并启动训练', GUIDANCE_HINT_IDS.workflow],
    ['history', '查看、比较和导出已完成的实验', GUIDANCE_HINT_IDS.history],
  ] as const)('在 %s 页面显示一条可收起的情境提示', async (page, hint, hintId) => {
    const user = userEvent.setup()
    const onDismissHint = vi.fn()
    render(
      <WorkbenchGuidance
        context={context(page)}
        dismissedHintIds={[]}
        helpOpen={false}
        onHelpOpenChange={vi.fn()}
        onDismissHint={onDismissHint}
        onRestoreHints={vi.fn()}
      />,
    )

    const card = screen.getByRole('region', { name: '页面操作提示' })
    expect(card).toHaveTextContent(hint)
    expect(screen.getAllByRole('region', { name: '页面操作提示' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '我知道了' }))
    expect(onDismissHint).toHaveBeenCalledWith(hintId)
  })

  it('已收起的页面提示不渲染', () => {
    render(
      <WorkbenchGuidance
        context={context('workflow')}
        dismissedHintIds={[GUIDANCE_HINT_IDS.workflow]}
        helpOpen={false}
        onHelpOpenChange={vi.fn()}
        onDismissHint={vi.fn()}
        onRestoreHints={vi.fn()}
      />,
    )

    expect(screen.queryByRole('region', { name: '页面操作提示' })).not.toBeInTheDocument()
  })

  it('收起当前提示后将焦点交给操作说明入口并可继续 Tab', async () => {
    const user = userEvent.setup()
    function ControlledHint() {
      const [dismissedHintIds, setDismissedHintIds] = useState<string[]>([])
      return (
        <>
          <WorkbenchGuidance
            context={context('setup')}
            dismissedHintIds={dismissedHintIds}
            helpOpen={false}
            onHelpOpenChange={vi.fn()}
            onDismissHint={(hintId) => setDismissedHintIds((ids) => [...ids, hintId])}
            onRestoreHints={vi.fn()}
          />
          <button type="button">下一个控件</button>
        </>
      )
    }

    render(<ControlledHint />)
    await user.click(screen.getByRole('button', { name: '我知道了' }))

    expect(screen.queryByRole('region', { name: '页面操作提示' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '操作说明' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '下一个控件' })).toHaveFocus()
  })

  it('打开帮助显示当前章节和完整流程章节，焦点留在入口', async () => {
    const user = userEvent.setup()
    const onHelpOpenChange = vi.fn()
    const { rerender } = render(
      <WorkbenchGuidance
        context={context('workflow', 'results')}
        dismissedHintIds={[]}
        helpOpen={false}
        onHelpOpenChange={onHelpOpenChange}
        onDismissHint={vi.fn()}
        onRestoreHints={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: '操作说明' })
    await user.click(trigger)
    expect(onHelpOpenChange).toHaveBeenCalledWith(true)
    rerender(
      <WorkbenchGuidance
        context={context('workflow', 'results')}
        dismissedHintIds={[]}
        helpOpen
        onHelpOpenChange={onHelpOpenChange}
        onDismissHint={vi.fn()}
        onRestoreHints={vi.fn()}
      />,
    )

    expect(document.activeElement).toBe(trigger)
    const panel = screen.getByRole('region', { name: '操作说明面板' })
    expect(panel).toHaveTextContent('结果与解释')
    expect(panel).toHaveTextContent('模型与数据')
    expect(panel).toHaveTextContent('历史记录')
    expect(panel).not.toHaveAttribute('aria-modal')
  })

  it('Tab 进入帮助内容，Shift+Tab 返回入口，Tab 可从面板离开', async () => {
    const user = userEvent.setup()
    render(
      <>
        <WorkbenchGuidance
          context={context('setup')}
          dismissedHintIds={[]}
          helpOpen
          onHelpOpenChange={vi.fn()}
          onDismissHint={vi.fn()}
          onRestoreHints={vi.fn()}
        />
        <button type="button">帮助之后的操作</button>
      </>,
    )

    const trigger = screen.getByRole('button', { name: '操作说明' })
    trigger.focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭操作说明' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(trigger)

    screen.getByRole('button', { name: '恢复页面提示' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '帮助之后的操作' }))
  })

  it('面板内 Escape 关闭帮助并将焦点返回入口', async () => {
    const user = userEvent.setup()
    const onHelpOpenChange = vi.fn()
    const { rerender } = render(
      <WorkbenchGuidance
        context={context('setup')}
        dismissedHintIds={[]}
        helpOpen
        onHelpOpenChange={onHelpOpenChange}
        onDismissHint={vi.fn()}
        onRestoreHints={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: '操作说明' })
    screen.getByRole('button', { name: '关闭操作说明' }).focus()
    await user.keyboard('{Escape}')
    expect(onHelpOpenChange).toHaveBeenCalledWith(false)
    expect(document.activeElement).toBe(trigger)

    rerender(
      <WorkbenchGuidance
        context={context('setup')}
        dismissedHintIds={[]}
        helpOpen={false}
        onHelpOpenChange={onHelpOpenChange}
        onDismissHint={vi.fn()}
        onRestoreHints={vi.fn()}
      />,
    )
    expect(screen.queryByRole('region', { name: '操作说明面板' })).not.toBeInTheDocument()
  })

  it('点击关闭帮助后将焦点返回入口', async () => {
    const user = userEvent.setup()
    const onHelpOpenChange = vi.fn()
    render(
      <WorkbenchGuidance
        context={context('setup')}
        dismissedHintIds={[]}
        helpOpen
        onHelpOpenChange={onHelpOpenChange}
        onDismissHint={vi.fn()}
        onRestoreHints={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: '操作说明' })
    await user.click(screen.getByRole('button', { name: '关闭操作说明' }))

    expect(onHelpOpenChange).toHaveBeenCalledWith(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('恢复提示时调用父级偏好回调', async () => {
    const user = userEvent.setup()
    const onRestoreHints = vi.fn()
    render(
      <WorkbenchGuidance
        context={context('history')}
        dismissedHintIds={[GUIDANCE_HINT_IDS.history]}
        helpOpen
        onHelpOpenChange={vi.fn()}
        onDismissHint={vi.fn()}
        onRestoreHints={onRestoreHints}
      />,
    )

    await user.click(screen.getByRole('button', { name: '恢复页面提示' }))
    expect(onRestoreHints).toHaveBeenCalledOnce()
  })

  it('上下文变化时更新当前章节而不重复提示或抢焦点', () => {
    const props = {
      dismissedHintIds: [] as string[],
      helpOpen: true,
      onHelpOpenChange: vi.fn(),
      onDismissHint: vi.fn(),
      onRestoreHints: vi.fn(),
    }
    const { rerender } = render(<WorkbenchGuidance {...props} context={context('workflow', 'training')} />)
    const trigger = screen.getByRole('button', { name: '操作说明' })
    trigger.focus()

    expect(screen.getByRole('region', { name: '操作说明面板' })).toHaveTextContent('训练过程')
    rerender(<WorkbenchGuidance {...props} context={{ ...context('workflow', 'architecture'), model: 'visual-cnn' }} />)

    expect(screen.getByRole('region', { name: '操作说明面板' })).toHaveTextContent('网络结构')
    expect(screen.getAllByRole('region', { name: '页面操作提示' })).toHaveLength(1)
    expect(document.activeElement).toBe(trigger)
  })
})

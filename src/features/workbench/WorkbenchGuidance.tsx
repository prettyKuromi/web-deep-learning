import { useId, useRef, type KeyboardEvent } from 'react'
import { getGuidanceContent, type GuidanceContext, type GuidancePage } from './guidanceContent'
import { GUIDANCE_HINT_IDS } from './guidancePreferences'
import './WorkbenchGuidance.css'

export interface WorkbenchGuidanceProps {
  context: GuidanceContext
  dismissedHintIds: readonly string[]
  helpOpen: boolean
  onHelpOpenChange: (open: boolean) => void
  onDismissHint: (hintId: string) => void
  onRestoreHints: () => void
}

const pageHints: Record<GuidancePage, string> = {
  setup: '先选择要解决的任务和模型，再选择兼容的数据并检查预览，确认后进入实验流程。',
  workflow: '配置模型参数并启动训练；完成后切换到结果与解释，理解本次指标。',
  history: '查看、比较和导出已完成的实验记录。',
}

export function WorkbenchGuidance({
  context,
  dismissedHintIds,
  helpOpen,
  onHelpOpenChange,
  onDismissHint,
  onRestoreHints,
}: WorkbenchGuidanceProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = `workbench-guidance-panel-${useId()}`
  const hintId = GUIDANCE_HINT_IDS[context.page]
  const content = getGuidanceContent(context)
  const showHint = !dismissedHintIds.includes(hintId)

  const closeHelp = () => {
    onHelpOpenChange(false)
    triggerRef.current?.focus()
  }

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && helpOpen) {
      event.preventDefault()
      event.stopPropagation()
      closeHelp()
    }
  }

  return (
    <div className="workbench-guidance">
      <div className={`workbench-guidance-row${showHint ? ' has-hint' : ''}`}>
        {showHint && (
          <aside className="workbench-guidance-hint" role="region" aria-label="页面操作提示">
            <span className="workbench-guidance-hint-mark" aria-hidden="true">i</span>
            <div className="workbench-guidance-hint-content">
              <span className="workbench-guidance-hint-label">页面提示</span>
              <p>{pageHints[context.page]}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onDismissHint(hintId)
                triggerRef.current?.focus()
              }}
            >
              我知道了
            </button>
          </aside>
        )}

        <button
          ref={triggerRef}
          type="button"
          className="workbench-guidance-trigger"
          aria-expanded={helpOpen}
          aria-controls={helpOpen ? panelId : undefined}
          onClick={() => helpOpen ? closeHelp() : onHelpOpenChange(true)}
          onKeyDown={handlePanelKeyDown}
        >
          <span className="workbench-guidance-trigger-mark" aria-hidden="true">?</span>
          <span>操作说明</span>
        </button>
      </div>

      {helpOpen && (
        <section
          id={panelId}
          className="workbench-guidance-panel"
          role="region"
          aria-label="操作说明面板"
          onKeyDown={handlePanelKeyDown}
        >
          <header className="workbench-guidance-panel-header">
            <h2>操作说明</h2>
            <button type="button" aria-label="关闭操作说明" onClick={closeHelp}>关闭</button>
          </header>

          <section className="workbench-guidance-current" aria-label="当前章节">
            <h3>{content.current.title}</h3>
            {content.current.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>

          <section className="workbench-guidance-other-chapters" aria-label="完整流程说明">
            {content.chapters
              .filter((chapter) => chapter.id !== content.current.id)
              .map((chapter) => (
                <article key={chapter.id}>
                  <h3>{chapter.title}</h3>
                  {chapter.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </article>
              ))}
          </section>

          <button className="workbench-guidance-restore" type="button" onClick={onRestoreHints}>恢复页面提示</button>
        </section>
      )}
    </div>
  )
}

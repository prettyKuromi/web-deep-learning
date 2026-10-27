import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import { getGuidanceContent, type GuidanceContext, type GuidancePage } from './guidanceContent'
import { GUIDANCE_HINT_IDS } from './guidancePreferences'
import './WorkbenchGuidance.css'

interface GuidanceTriggerProps {
  helpOpen: boolean
  panelId: string
  triggerRef: RefObject<HTMLButtonElement | null>
  onHelpOpenChange: (open: boolean) => void
}

export interface WorkbenchGuidanceHintProps {
  context: GuidanceContext
  dismissedHintIds: readonly string[]
  onDismissHint: (hintId: string) => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

export interface WorkbenchGuidanceProps {
  context: GuidanceContext
  helpOpen: boolean
  panelId: string
  triggerRef: RefObject<HTMLButtonElement | null>
  onHelpOpenChange: (open: boolean) => void
  onRestoreHints: () => void
}

const pageHints: Record<GuidancePage, string> = {
  setup: '先选择要解决的任务和模型，再选择兼容的数据并检查预览，确认后进入实验流程。',
  workflow: '配置模型参数并启动训练；完成后切换到结果与解释，理解本次指标。',
  history: '查看、比较和导出已完成的实验记录。',
}

function closeHelp(triggerRef: RefObject<HTMLButtonElement | null>, onHelpOpenChange: (open: boolean) => void) {
  onHelpOpenChange(false)
  triggerRef.current?.focus()
}

function handleEscape(event: KeyboardEvent<HTMLElement>, triggerRef: RefObject<HTMLButtonElement | null>, onHelpOpenChange: (open: boolean) => void) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  closeHelp(triggerRef, onHelpOpenChange)
}

export function WorkbenchGuidanceTrigger({ helpOpen, panelId, triggerRef, onHelpOpenChange }: GuidanceTriggerProps) {
  return (
    <button
      ref={triggerRef}
      type="button"
      className="workbench-guidance-trigger"
      aria-expanded={helpOpen}
      aria-controls={helpOpen ? panelId : undefined}
      onClick={() => helpOpen ? closeHelp(triggerRef, onHelpOpenChange) : onHelpOpenChange(true)}
      onKeyDown={(event) => helpOpen && handleEscape(event, triggerRef, onHelpOpenChange)}
    >
      <span className="workbench-guidance-trigger-mark" aria-hidden="true">?</span>
      <span>操作说明</span>
    </button>
  )
}

export function WorkbenchGuidanceHint({ context, dismissedHintIds, onDismissHint, triggerRef }: WorkbenchGuidanceHintProps) {
  const hintId = GUIDANCE_HINT_IDS[context.page]
  if (dismissedHintIds.includes(hintId)) return null

  return (
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
  )
}

export function WorkbenchGuidance({
  context,
  helpOpen,
  panelId,
  triggerRef,
  onHelpOpenChange,
  onRestoreHints,
}: WorkbenchGuidanceProps) {
  const panelRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<CSSProperties>()

  useLayoutEffect(() => {
    if (!helpOpen) {
      setPosition(undefined)
      return
    }

    const updatePosition = () => {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return

      const triggerRect = trigger.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth
      const viewportHeight = window.innerHeight
      const margin = 12
      const gap = 8
      const width = Math.min(608, viewportWidth - margin * 2)
      const left = Math.max(margin, Math.min(triggerRect.right - width, viewportWidth - width - margin))
      const contentHeight = panel.scrollHeight
      const below = viewportHeight - triggerRect.bottom - gap - margin
      const above = triggerRect.top - gap - margin
      const placeAbove = below < Math.min(contentHeight, 280) && above > below
      const maxHeight = Math.max(0, Math.min(contentHeight, placeAbove ? above : below))
      const top = placeAbove ? triggerRect.top - gap - maxHeight : triggerRect.bottom + gap
      setPosition({ position: 'fixed', top, left, width, maxHeight })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [context, helpOpen, panelId, triggerRef])

  useEffect(() => {
    if (!helpOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onHelpOpenChange(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [helpOpen, onHelpOpenChange, triggerRef])

  if (!helpOpen) return null

  const content = getGuidanceContent(context)
  return (
    <section
      ref={panelRef}
      id={panelId}
      className="workbench-guidance-panel"
      role="region"
      aria-label="操作说明面板"
      onKeyDown={(event) => handleEscape(event, triggerRef, onHelpOpenChange)}
      style={position ?? { visibility: 'hidden' }}
    >
      <header className="workbench-guidance-panel-header">
        <h2>操作说明</h2>
        <button type="button" aria-label="关闭操作说明" onClick={() => closeHelp(triggerRef, onHelpOpenChange)}>关闭</button>
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
  )
}

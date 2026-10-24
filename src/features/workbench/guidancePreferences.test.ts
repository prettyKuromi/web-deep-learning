import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GUIDANCE_HINT_IDS,
  GUIDANCE_PREFERENCES_KEY,
  dismissGuidanceHint,
  readGuidancePreferences,
  restoreGuidanceHints,
} from './guidancePreferences'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('工作台引导偏好', () => {
  it('为三个页面提供稳定提示标识', () => {
    expect(GUIDANCE_HINT_IDS).toEqual({
      setup: 'setup-introduction',
      workflow: 'workflow-introduction',
      history: 'history-introduction',
    })
  })

  it('空存储返回版本化的空收起集合', () => {
    expect(readGuidancePreferences()).toEqual({ version: 1, dismissedHintIds: [] })
  })

  it('收起提示后持久化稳定标识且不重复添加', () => {
    const first = dismissGuidanceHint('setup-introduction')
    const second = dismissGuidanceHint('setup-introduction', first)

    expect(second).toEqual({ version: 1, dismissedHintIds: ['setup-introduction'] })
    expect(JSON.parse(localStorage.getItem(GUIDANCE_PREFERENCES_KEY) ?? 'null')).toEqual(second)
  })

  it('恢复提示会清除已收起标识并写回默认偏好', () => {
    dismissGuidanceHint('history-introduction')

    expect(restoreGuidanceHints()).toEqual({ version: 1, dismissedHintIds: [] })
    expect(readGuidancePreferences()).toEqual({ version: 1, dismissedHintIds: [] })
  })

  it('损坏 JSON 和未知版本安全回退为空集合', () => {
    localStorage.setItem(GUIDANCE_PREFERENCES_KEY, '{')
    expect(readGuidancePreferences()).toEqual({ version: 1, dismissedHintIds: [] })

    localStorage.setItem(GUIDANCE_PREFERENCES_KEY, JSON.stringify({ version: 9, dismissedHintIds: ['setup-introduction'] }))
    expect(readGuidancePreferences()).toEqual({ version: 1, dismissedHintIds: [] })
  })

  it('可迁移的旧结构保留已收起提示并升级到版本 1', () => {
    localStorage.setItem(GUIDANCE_PREFERENCES_KEY, JSON.stringify({ dismissedHintIds: ['workflow-introduction'] }))

    expect(readGuidancePreferences()).toEqual({ version: 1, dismissedHintIds: ['workflow-introduction'] })
  })

  it('存储读取异常时恢复默认值且不抛错', () => {
    const storage = { getItem: () => { throw new Error('读取失败') }, setItem: () => {} } as unknown as Storage

    expect(() => readGuidancePreferences(storage)).not.toThrow()
    expect(readGuidancePreferences(storage)).toEqual({ version: 1, dismissedHintIds: [] })
  })

  it('浏览器没有 localStorage 时使用会话默认值', () => {
    vi.stubGlobal('localStorage', undefined)

    expect(readGuidancePreferences()).toEqual({ version: 1, dismissedHintIds: [] })
    expect(dismissGuidanceHint('setup-introduction')).toEqual({
      version: 1,
      dismissedHintIds: ['setup-introduction'],
    })
  })

  it('从注入存储读取并保留已有收起标识', () => {
    let saved = JSON.stringify({ version: 1, dismissedHintIds: ['setup-introduction'] })
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => { saved = value },
    } as unknown as Storage

    expect(dismissGuidanceHint('history-introduction', undefined, storage)).toEqual({
      version: 1,
      dismissedHintIds: ['setup-introduction', 'history-introduction'],
    })
    expect(JSON.parse(saved)).toEqual({
      version: 1,
      dismissedHintIds: ['setup-introduction', 'history-introduction'],
    })
  })

  it('存储写入异常时仍返回当前会话的收起状态', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('写入失败') } } as unknown as Storage

    expect(dismissGuidanceHint('setup-introduction', undefined, storage)).toEqual({
      version: 1,
      dismissedHintIds: ['setup-introduction'],
    })
    expect(restoreGuidanceHints(storage)).toEqual({ version: 1, dismissedHintIds: [] })
  })
})

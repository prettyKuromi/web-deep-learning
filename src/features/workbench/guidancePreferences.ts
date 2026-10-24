export const GUIDANCE_PREFERENCES_KEY = 'workbench-guidance:v1'

export const GUIDANCE_HINT_IDS = {
  setup: 'setup-introduction',
  workflow: 'workflow-introduction',
  history: 'history-introduction',
} as const

export interface GuidancePreferences {
  version: 1
  dismissedHintIds: string[]
}

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

const emptyPreferences = (): GuidancePreferences => ({ version: 1, dismissedHintIds: [] })

function getStorage(storage?: PreferenceStorage): PreferenceStorage | undefined {
  if (storage) return storage
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function persist(preferences: GuidancePreferences, storage?: PreferenceStorage): GuidancePreferences {
  try {
    getStorage(storage)?.setItem(GUIDANCE_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // 引导偏好不可用时，当前会话仍可正常显示和收起提示。
  }
  return preferences
}

export function readGuidancePreferences(storage?: PreferenceStorage): GuidancePreferences {
  const target = getStorage(storage)
  if (!target) return emptyPreferences()

  try {
    const raw = target.getItem(GUIDANCE_PREFERENCES_KEY)
    if (!raw) return emptyPreferences()

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('dismissedHintIds' in parsed)) {
      return emptyPreferences()
    }

    const value = parsed as { version?: unknown; dismissedHintIds?: unknown }
    if (!Array.isArray(value.dismissedHintIds) || !value.dismissedHintIds.every((id) => typeof id === 'string' && id.length > 0)) {
      return emptyPreferences()
    }

    const preferences: GuidancePreferences = {
      version: 1,
      dismissedHintIds: [...new Set(value.dismissedHintIds)],
    }

    if (value.version === 1) return preferences
    if (value.version === undefined || value.version === 0) return persist(preferences, target)
    return emptyPreferences()
  } catch {
    return emptyPreferences()
  }
}

export function dismissGuidanceHint(
  hintId: string,
  current?: GuidancePreferences,
  storage?: PreferenceStorage,
): GuidancePreferences {
  if (!hintId) return current ?? readGuidancePreferences(storage)
  const preferences = current ?? readGuidancePreferences(storage)
  return persist({
    version: 1,
    dismissedHintIds: preferences.dismissedHintIds.includes(hintId)
      ? preferences.dismissedHintIds
      : [...preferences.dismissedHintIds, hintId],
  }, storage)
}

export function restoreGuidanceHints(storage?: PreferenceStorage): GuidancePreferences {
  return persist(emptyPreferences(), storage)
}

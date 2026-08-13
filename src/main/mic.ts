import { systemPreferences } from 'electron'
import type { MicStatus } from '../shared/types'

/** 获取麦克风权限状态（macOS） */
export function getMicStatus(): MicStatus {
  if (process.platform !== 'darwin') return 'granted'
  return systemPreferences.getMediaAccessStatus('microphone') as MicStatus
}

/** 请求麦克风权限（macOS 只允许主动触发） */
export async function requestMicPermission(): Promise<MicStatus> {
  if (process.platform !== 'darwin') return 'granted'
  const current = getMicStatus()
  if (current === 'granted') return current
  if (current === 'denied' || current === 'restricted') return current
  try {
    const ok = await systemPreferences.askForMediaAccess('microphone')
    return ok ? 'granted' : 'denied'
  } catch {
    return getMicStatus()
  }
}

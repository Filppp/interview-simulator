import { systemPreferences } from 'electron'
import type { MicStatus } from '../shared/types'

/**
 * 麦克风权限状态。
 *
 * - macOS：系统按应用授权，必须显式申请（首次会弹系统弹窗）。
 * - Windows：没有「按应用」的授权 API（Electron 的 askForMediaAccess 仅 macOS 可用），
 *   权限由「设置 → 隐私和安全性 → 麦克风 → 允许桌面应用访问麦克风」统一管控。
 *   这里直接返回 granted，真正的失败会在 getUserMedia 时抛出，由界面给出中文指引。
 */
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

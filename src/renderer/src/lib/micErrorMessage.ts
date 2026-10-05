/**
 * 把 getUserMedia / MediaRecorder 抛出的原始英文错误，
 * 翻译成用户能直接照做的中文提示（macOS 与 Windows 的权限入口不同）。
 */
export function micErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  const detail = e instanceof Error ? e.message : String(e)
  const isWin =
    typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return isWin
        ? '麦克风被拒绝。请打开「设置 → 隐私和安全性 → 麦克风」，确保「麦克风访问」和「允许桌面应用访问麦克风」都已开启，然后重启本应用。'
        : '麦克风被拒绝。请在「系统设置 → 隐私与安全性 → 麦克风」中允许本应用使用麦克风，然后重启本应用。'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '没有检测到可用的麦克风设备，请检查麦克风是否已连接后重试。'
    case 'NotReadableError':
    case 'AbortError':
      return '麦克风被其他程序占用（例如会议/录音软件），请先关闭它们再重试。'
    default:
      return `无法录音：${detail}`
  }
}

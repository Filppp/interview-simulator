/** 主进程与渲染进程共用的格式化工具 */

/** 秒数 → 中文时长文案，例如 150 → "2 分 30 秒"、120 → "2 分钟" */
export function fmtDurationZh(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r} 秒`
  if (r === 0) return `${m} 分钟`
  return `${m} 分 ${r} 秒`
}

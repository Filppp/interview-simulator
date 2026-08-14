import { useEffect, useState } from 'react'
import type { InterviewReport } from '../../../shared/types'

const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  intro: { label: '自我介绍', icon: '🗣️' },
  english: { label: '英语口语', icon: '🇬🇧' },
  major: { label: '专业课', icon: '📖' },
  resume: { label: '简历问答', icon: '📄' }
}

const ITEM_LABELS: Record<string, string> = {
  structure: '内容结构',
  highlights: '亮点突出',
  fluency: '表达流畅',
  timeControl: '时长控制',
  pronunciation: '发音',
  grammar: '语法',
  content: '内容质量',
  responsiveness: '应变',
  accuracy: '知识准确性',
  logic: '逻辑性',
  depth: '深度',
  followupResponse: '追问应对',
  consistency: '回答一致性',
  adaptability: '临场应变'
}

function fmtTime(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m} 分 ${String(s).padStart(2, '0')} 秒`
}

export default function Report({ reportId }: { reportId: string | null }): React.JSX.Element {
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [replayOpen, setReplayOpen] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  useEffect(() => {
    setReport(null)
    if (!reportId) return
    setLoading(true)
    void window.api.getHistoryRecord(reportId).then((r) => {
      setReport(r)
      setLoading(false)
    })
  }, [reportId])

  const handleExport = async (): Promise<void> => {
    if (!report) return
    const r = await window.api.exportReportMarkdown(report.id)
    setExportMsg(r.ok ? `✅ 已导出：${r.filePath}` : r.message ?? '导出失败')
  }

  if (!reportId) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>评分报告</h1>
          <p>面试结束后的分项评分与改进建议</p>
        </header>
        <div className="card placeholder">
          <h2>📊 还没有要展示的报告</h2>
          <p>完成一次模拟面试并生成报告后，会在这里展示；也可以从「历史记录」中打开过往报告。</p>
        </div>
      </div>
    )
  }

  if (loading) return <div className="page-loading">加载中…</div>

  if (!report) {
    return (
      <div className="page">
        <div className="card placeholder">
          <h2>⚠️ 报告不存在</h2>
          <p>该记录可能已被删除。</p>
        </div>
      </div>
    )
  }

  const groups: Array<[string, Record<string, number>]> = [
    ['intro', report.scores.intro],
    ['english', report.scores.english],
    ['major', report.scores.major],
    ['resume', report.scores.resume]
  ]

  const totalColor = report.total >= 8 ? 'excellent' : report.total >= 6 ? 'good' : report.total >= 4 ? 'mid' : 'poor'

  return (
    <div className="page">
      <header className="page-header">
        <h1>评分报告</h1>
        <p>
          {new Date(report.startedAt).toLocaleString('zh-CN')} · 用时 {fmtTime(report.durationSec)}
          {report.schoolName && ` · 目标学校 ${report.schoolName}`}
        </p>
      </header>

      <div className="card report-hero">
        <div className={`report-total ${totalColor}`}>
          <div className="report-total-num">{report.total.toFixed(1)}</div>
          <div className="report-total-label">总分 / 10</div>
        </div>
        <div className="report-comment">
          <h2 className="card-title" style={{ marginBottom: 8 }}>
            💬 总体评语
          </h2>
          <p>{report.comment || '（无评语）'}</p>
          {report.suggestions.length > 0 && (
            <>
              <h3 style={{ margin: '14px 0 8px', fontSize: 14 }}>📌 改进建议</h3>
              <ol className="suggestions">
                {report.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>

      <div className="score-grid">
        {groups.map(([key, scores]) => {
          const g = GROUP_LABELS[key]
          const items = Object.entries(scores)
          const avg = items.reduce((a, [, v]) => a + v, 0) / items.length
          return (
            <div className="card score-card" key={key}>
              <div className="score-card-head">
                <span>
                  {g.icon} {g.label}
                </span>
                <span className={`score-avg ${avg >= 8 ? 'ok-text' : avg >= 6 ? '' : 'bad-text'}`}>
                  {avg.toFixed(1)}
                </span>
              </div>
              {items.map(([k, v]) => (
                <div className="score-row" key={k}>
                  <span className="score-name">{ITEM_LABELS[k] ?? k}</span>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${v * 10}%`, background: v >= 8 ? 'var(--ok)' : v >= 6 ? 'var(--accent)' : 'var(--warn)' }} />
                  </div>
                  <span className="score-val">{v.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="inline-actions">
          <button className="btn" onClick={() => setReplayOpen((o) => !o)}>
            {replayOpen ? '收起问答回放' : `📜 展开问答回放（${report.messages.length} 条）`}
          </button>
          <button className="btn primary" onClick={() => void handleExport()}>
            📤 导出 Markdown
          </button>
        </div>
        {exportMsg && <p className="hint">{exportMsg}</p>}
        {replayOpen && (
          <div className="replay">
            {report.messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div className="chat-bubble">{m.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

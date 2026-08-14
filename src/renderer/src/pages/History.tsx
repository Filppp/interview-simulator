import { useCallback, useEffect, useState } from 'react'
import type { HistorySummary, InterviewReport } from '../../../shared/types'

const PRESET_LABELS: Record<string, string> = {
  gentle: '温和引导',
  standard: '标准型',
  strict: '压力型',
  academic: '学术深挖'
}

function fmtTime(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}分${String(s).padStart(2, '0')}秒`
}

export default function History({ onOpenReport }: { onOpenReport: (id: string) => void }): React.JSX.Element {
  const [records, setRecords] = useState<HistorySummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [compareData, setCompareData] = useState<Array<InterviewReport | null>>([])

  const refresh = useCallback(async (): Promise<void> => {
    setRecords(await window.api.listHistory())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggleSelect = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 2) next.add(id)
      return next
    })
  }

  const handleCompare = async (): Promise<void> => {
    const ids = [...selected]
    const data = await Promise.all(ids.map((id) => window.api.getHistoryRecord(id)))
    setCompareData(data)
  }

  const handleRemove = async (id: string): Promise<void> => {
    if (!window.confirm('确定删除这条历史记录？')) return
    await window.api.removeHistoryRecord(id)
    setSelected(new Set())
    setCompareData([])
    await refresh()
  }

  const groupOf = (scores: InterviewReport['scores']): Array<[string, number]> => {
    const avg = (o: Record<string, number>): number => {
      const vs = Object.values(o)
      return Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10) / 10
    }
    return [
      ['自我介绍', avg(scores.intro)],
      ['英语口语', avg(scores.english)],
      ['专业课', avg(scores.major)],
      ['简历问答', avg(scores.resume)]
    ]
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>历史记录</h1>
        <p>查看过往模拟面试的评分报告，选择两条可对比进步情况</p>
      </header>

      {records.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">🕘</div>
            <p>还没有面试记录</p>
            <p className="empty-sub">完成一次面试并生成评分报告后，会出现在这里</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="cat-bar">
            <strong>共 {records.length} 条记录</strong>
            {selected.size === 2 && (
              <button className="btn primary" onClick={() => void handleCompare()}>
                ⚖️ 对比选中的 2 条
              </button>
            )}
            {selected.size > 0 && <span className="count-badge">已选 {selected.size}/2</span>}
          </div>
          <ul className="material-list">
            {records.map((r) => (
              <li
                key={r.id}
                className={`material-item${selected.has(r.id) ? ' selected' : ''}`}
                onClick={() => toggleSelect(r.id)}
                onDoubleClick={() => onOpenReport(r.id)}
              >
                <div className="material-icon">📊</div>
                <div className="material-info">
                  <div className="material-name">
                    {new Date(r.startedAt).toLocaleString('zh-CN')}
                    {r.schoolName && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{r.schoolName}</span>}
                  </div>
                  <div className="material-meta">
                    <span>{PRESET_LABELS[r.preset] ?? r.preset}</span>
                    <span>用时 {fmtTime(r.durationSec)}</span>
                  </div>
                </div>
                <div className={`material-score ${r.total >= 8 ? 'ok-text' : r.total >= 6 ? '' : 'bad-text'}`}>
                  {r.total.toFixed(1)}
                </div>
                <div className="material-actions">
                  <button className="btn small" onClick={(e) => { e.stopPropagation(); onOpenReport(r.id) }}>
                    查看
                  </button>
                  <button className="btn small danger" onClick={(e) => { e.stopPropagation(); void handleRemove(r.id) }}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="hint">单击勾选（最多 2 条）→ 对比；双击直接打开报告。</p>
        </div>
      )}

      {compareData.length === 2 && (
        <div className="card">
          <div className="cat-bar">
            <strong>⚖️ 对比</strong>
            <button className="btn" onClick={() => setCompareData([])}>
              关闭对比
            </button>
          </div>
          {compareData.every((d) => d !== null) && (
            <table className="compare-table">
              <thead>
                <tr>
                  <th>维度</th>
                  {compareData.map((d) => (
                    <th key={d!.id}>
                      {new Date(d!.startedAt).toLocaleDateString('zh-CN')}
                      <br />
                      <span className="compare-total">{d!.total.toFixed(1)}</span>
                    </th>
                  ))}
                  <th>差值</th>
                </tr>
              </thead>
              <tbody>
                {groupOf(compareData[0]!.scores).map(([label, v0], gi) => {
                  const v1 = groupOf(compareData[1]!.scores)[gi][1]
                  const diff = Math.round((v1 - v0) * 10) / 10
                  return (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>{v0.toFixed(1)}</td>
                      <td>{v1.toFixed(1)}</td>
                      <td className={diff > 0 ? 'ok-text' : diff < 0 ? 'bad-text' : ''}>
                        {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

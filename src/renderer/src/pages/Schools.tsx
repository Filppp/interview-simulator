import { useCallback, useEffect, useState } from 'react'
import type { SchoolProfile } from '../../../shared/types'

const TARGETS = ['复试', '保研', '夏令营']

export default function Schools(): React.JSX.Element {
  const [schools, setSchools] = useState<SchoolProfile[]>([])
  const [editing, setEditing] = useState<SchoolProfile | null>(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('复试')
  const [notesText, setNotesText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setSchools(await window.api.listSchools())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startNew = (): void => {
    setEditing(null)
    setName('')
    setTarget('复试')
    setNotesText('')
    setError(null)
  }

  const startEdit = (s: SchoolProfile): void => {
    setEditing(s)
    setName(s.name)
    setTarget(s.target)
    setNotesText(s.notes.join('\n\n'))
    setError(null)
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) {
      setError('请填写学校名称')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const notes = notesText
        .split(/\n\s*\n/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
      await window.api.saveSchool({ id: editing?.id, name: name.trim(), target, notes })
      await refresh()
      startNew()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (s: SchoolProfile): Promise<void> => {
    if (!window.confirm(`确定删除「${s.name}」的风格资料？`)) return
    await window.api.removeSchool(s.id)
    if (editing?.id === s.id) startNew()
    await refresh()
  }

  const handleImport = async (s: SchoolProfile): Promise<void> => {
    const updated = await window.api.pickAndImportSchoolFiles(s.id)
    if (updated) {
      await refresh()
      if (editing?.id === s.id) startEdit(updated)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>学校风格</h1>
        <p>录入目标院校的面试风格与真题回忆，面试官将尽量贴合该校真实风格（来源：小红书 / 经验贴等，自行整理）</p>
      </header>

      <div className="school-layout">
        <div className="card">
          <div className="cat-bar">
            <strong>🏫 学校列表（{schools.length}）</strong>
            <button className="btn primary" onClick={startNew}>
              ＋ 新增学校
            </button>
          </div>
          {schools.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🏫</div>
              <p>还没有录入学校风格</p>
              <p className="empty-sub">点击「新增学校」，把你搜集的复试风格描述粘贴进来</p>
            </div>
          ) : (
            <ul className="material-list">
              {schools.map((s) => (
                <li
                  key={s.id}
                  className={`material-item${editing?.id === s.id ? ' selected' : ''}`}
                  onClick={() => startEdit(s)}
                >
                  <div className="material-icon">🎓</div>
                  <div className="material-info">
                    <div className="material-name">{s.name}</div>
                    <div className="material-meta">
                      <span>{s.target}</span>
                      <span>{s.notes.length} 条笔记</span>
                      {s.files.length > 0 && <span>{s.files.length} 个文件</span>}
                    </div>
                  </div>
                  <div className="material-actions">
                    <button
                      className="btn small"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleImport(s)
                      }}
                    >
                      导入文件
                    </button>
                    <button
                      className="btn small danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRemove(s)
                      }}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">{editing ? `✏️ 编辑：${editing.name}` : '➕ 新增学校'}</h2>
          <div className="form-row">
            <label>学校名称</label>
            <input value={name} placeholder="如：浙江大学 · 计算机学院" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-row">
            <label>报考类型</label>
            <div className="inline-actions">
              {TARGETS.map((t) => (
                <button
                  key={t}
                  className={`btn small${target === t ? ' primary' : ''}`}
                  onClick={() => setTarget(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label>风格笔记</label>
            <textarea
              rows={10}
              value={notesText}
              placeholder={'粘贴你在网上搜集的该校面试风格、真题回忆等。\n\n每段用空行分隔，例如：\n\n【英语环节】英文自我介绍 1 分钟，然后问家乡和为什么选我们学校，语速正常不刁难。\n\n【专业课】计网问 TCP 三次握手，OS 问进程调度，会追问到实现细节。'}
              onChange={(e) => setNotesText(e.target.value)}
            />
          </div>
          {error && <div className="err-banner">⚠️ {error}</div>}
          <div className="inline-actions" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
            {editing && (
              <button className="btn" onClick={startNew}>
                取消编辑
              </button>
            )}
          </div>
          <p className="hint">
            面试开始时可选择绑定某所学校；绑定时该校全部笔记会作为面试官风格参考。
            也可「导入文件」（PDF/Word/TXT）批量录入已整理的资料。
          </p>
        </div>
      </div>
    </div>
  )
}

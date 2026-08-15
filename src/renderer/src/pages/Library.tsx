import { useCallback, useEffect, useState } from 'react'
import type { MaterialCategory, MaterialDetail, MaterialMeta } from '../../../shared/types'

const CATEGORIES: Array<{ key: MaterialCategory; label: string; icon: string; desc: string }> = [
  { key: 'english', label: '英语资料', icon: '🇬🇧', desc: '用于英语口语问答出题' },
  { key: 'major', label: '专业课资料', icon: '📖', desc: '用于专业课问答出题' },
  { key: 'resume', label: '简历', icon: '📄', desc: '用于简历提问环节' }
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Library(): React.JSX.Element {
  const [active, setActive] = useState<MaterialCategory>('english')
  const [materials, setMaterials] = useState<MaterialMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<MaterialDetail | null>(null)

  const refresh = useCallback(async (category: MaterialCategory = active): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.api.listMaterials(category)
      setMaterials(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [active])

  useEffect(() => {
    void refresh(active)
    setDetail(null)
  }, [active, refresh])

  const handleImport = async (): Promise<void> => {
    setImporting(true)
    setError(null)
    try {
      const added = await window.api.pickAndAddMaterials(active)
      if (added.length > 0) {
        await refresh(active)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }

  const handleRemove = async (id: string, name: string): Promise<void> => {
    if (!window.confirm(`确定删除「${name}」？将同时移除解析缓存。`)) return
    try {
      await window.api.removeMaterial(id)
      setDetail(null)
      await refresh(active)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handlePreview = async (id: string): Promise<void> => {
    const d = await window.api.previewMaterial(id)
    setDetail(d)
  }

  const cat = CATEGORIES.find((c) => c.key === active)!

  return (
    <div className="page">
      <header className="page-header">
        <h1>资料库</h1>
        <p>导入并管理英语资料、专业课资料与简历（支持 PDF / Word / Markdown / TXT），面试时将基于这些内容出题</p>
      </header>

      <div className="cat-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`cat-tab${active === c.key ? ' active' : ''}`}
            onClick={() => setActive(c.key)}
          >
            <span>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="cat-bar">
          <div>
            <strong>{cat.icon} {cat.label}</strong>
            <span className="cat-desc">{cat.desc}</span>
          </div>
          <div className="cat-actions">
            {materials.length > 0 && <span className="count-badge">{materials.length} 份</span>}
            <button className="btn primary" onClick={() => void handleImport()} disabled={importing}>
              {importing ? '导入中…' : '＋ 导入文件'}
            </button>
          </div>
        </div>

        {error && <div className="err-banner">⚠️ {error}</div>}

        {loading ? (
          <div className="empty">加载中…</div>
        ) : materials.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <p>该分类下还没有资料</p>
            <p className="empty-sub">
              点击「导入文件」选择 PDF / Word / MD / TXT（可多选）。
              {active === 'resume' && '建议只导入一份最新简历。'}
            </p>
          </div>
        ) : (
          <ul className="material-list">
            {materials.map((m) => (
              <li
                key={m.id}
                className={`material-item${detail?.meta.id === m.id ? ' selected' : ''}${m.status === 'error' ? ' has-error' : ''}`}
                onClick={() => void handlePreview(m.id)}
              >
                <div className="material-icon">{m.ext === 'pdf' ? '📕' : '📘'}</div>
                <div className="material-info">
                  <div className="material-name">{m.name}</div>
                  <div className="material-meta">
                    {m.status === 'error' ? (
                      <span className="err-text">解析失败：{m.error}</span>
                    ) : (
                      <>
                        <span>{m.ext.toUpperCase()}</span>
                        {m.pageCount != null && <span>{m.pageCount} 页</span>}
                        <span>{m.charCount.toLocaleString()} 字</span>
                        <span>{formatSize(m.sizeBytes)}</span>
                      </>
                    )}
                    <span>{formatDate(m.addedAt)}</span>
                  </div>
                </div>
                <div className="material-actions">
                  <button className="btn small" onClick={() => void handlePreview(m.id)}>
                    预览
                  </button>
                  <button className="btn small danger" onClick={(e) => { e.stopPropagation(); void handleRemove(m.id, m.name) }}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail && (
        <div className="card preview-card">
          <div className="preview-head">
            <strong>预览：{detail.meta.name}</strong>
            <span className="count-badge">{detail.text.length.toLocaleString()} 字符</span>
          </div>
          <pre className="preview-body">{detail.text}</pre>
        </div>
      )}
    </div>
  )
}

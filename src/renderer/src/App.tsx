import { useState } from 'react'

import Settings from './pages/Settings'
import Library from './pages/Library'
import Interview from './pages/Interview'
import Report from './pages/Report'
import History from './pages/History'
import Schools from './pages/Schools'

export type PageKey = 'interview' | 'library' | 'schools' | 'report' | 'history' | 'settings'

const NAV: Array<{ key: PageKey; label: string; icon: string }> = [
  { key: 'interview', label: '模拟面试', icon: '🎙️' },
  { key: 'library', label: '资料库', icon: '📚' },
  { key: 'schools', label: '学校风格', icon: '🏫' },
  { key: 'report', label: '评分报告', icon: '📊' },
  { key: 'history', label: '历史记录', icon: '🕘' },
  { key: 'settings', label: '设置', icon: '⚙️' }
]

export default function App(): React.JSX.Element {
  const [page, setPage] = useState<PageKey>('interview')

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-title">
          <span className="logo">🎓</span>
          <div>
            <div className="logo-name">面试模拟器</div>
            <div className="logo-sub">复试 · 保研</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={`nav-item${page === item.key ? ' active' : ''}`}
              onClick={() => setPage(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">v0.1 · 开发中</div>
      </aside>
      <main className="content">
        {page === 'interview' && <Interview />}
        {page === 'library' && <Library />}
        {page === 'report' && <Report />}
        {page === 'history' && <History />}
        {page === 'settings' && <Settings />}
        {page === 'schools' && <Schools />}
      </main>
    </div>
  )
}

export default function Interview(): React.JSX.Element {
  return (
    <div className="page">
      <header className="page-header">
        <h1>模拟面试</h1>
        <p>四阶段面试流程，AI 扮演面试官</p>
      </header>

      <div className="flow">
        {[
          { icon: '🗣️', name: '自我介绍', desc: '计时陈述，AI 追问', state: 'todo' },
          { icon: '🇬🇧', name: '英语口语问答', desc: '全英文，基于英语资料', state: 'todo' },
          { icon: '📖', name: '专业课问答', desc: '基于专业课资料，由浅入深', state: 'todo' },
          { icon: '📄', name: '简历提问', desc: '结合简历深挖', state: 'todo' }
        ].map((s, i) => (
          <div className="flow-step" key={s.name}>
            <div className="flow-icon">{s.icon}</div>
            <div className="flow-name">{s.name}</div>
            <div className="flow-desc">{s.desc}</div>
            <div className="flow-index">阶段 {i + 1}</div>
          </div>
        ))}
      </div>

      <div className="card placeholder">
        <h2>🚧 功能开发中（M4 里程碑）</h2>
        <p>
          本页面将实现完整的四阶段面试流程：语音问答、计时控制、DeepSeek 智能出题与追问。
          在此之前，请先在「资料库」导入你的英语资料、专业课资料和简历，并在「设置」中完成 API Key 配置。
        </p>
      </div>
    </div>
  )
}

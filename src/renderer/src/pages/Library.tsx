export default function Library(): React.JSX.Element {
  return (
    <div className="page">
      <header className="page-header">
        <h1>资料库</h1>
        <p>导入并管理英语资料、专业课资料与简历（支持 PDF / Word）</p>
      </header>
      <div className="card placeholder">
        <h2>🚧 功能开发中（M2 里程碑）</h2>
        <p>将支持：批量导入 PDF/Word 文件，按「英语资料 / 专业课资料 / 简历」分类，解析文本、预览内容、重建索引。</p>
      </div>
    </div>
  )
}

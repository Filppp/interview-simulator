import { randomUUID } from 'node:crypto'
import { promises as fs, mkdirSync } from 'node:fs'
import path from 'node:path'
import { dataRoot } from './store'
import { generateReportContent, computeTotal } from './report'
import type { HistorySummary, InterviewReport, SessionToReport } from '../shared/types'

function historyDir(): string {
  return path.join(dataRoot(), 'history')
}

function indexFile(): string {
  return path.join(historyDir(), 'records.json')
}

function recordFile(id: string): string {
  return path.join(historyDir(), `report-${id}.json`)
}

async function loadIndex(): Promise<HistorySummary[]> {
  try {
    const raw = await fs.readFile(indexFile(), 'utf-8')
    const arr = JSON.parse(raw) as HistorySummary[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

async function saveIndex(list: HistorySummary[]): Promise<void> {
  const tmp = indexFile() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf-8')
  await fs.rename(tmp, indexFile())
}

export async function listHistory(): Promise<HistorySummary[]> {
  const list = await loadIndex()
  return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function getRecord(id: string): Promise<InterviewReport | null> {
  try {
    const raw = await fs.readFile(recordFile(id), 'utf-8')
    return JSON.parse(raw) as InterviewReport
  } catch {
    return null
  }
}

export async function removeRecord(id: string): Promise<void> {
  const list = await loadIndex()
  await fs.unlink(recordFile(id)).catch(() => {})
  await saveIndex(list.filter((r) => r.id !== id))
}

/** 生成评分报告并保存 */
export async function createReport(session: SessionToReport): Promise<InterviewReport> {
  const { scores, comment, suggestions } = await generateReportContent(session)
  const record: InterviewReport = {
    id: randomUUID(),
    startedAt: session.startedAt,
    durationSec: session.durationSec,
    schoolName: session.schoolName,
    preset: session.preset,
    scores,
    total: computeTotal(scores),
    comment,
    suggestions,
    messages: session.messages
  }

  mkdirSync(historyDir(), { recursive: true })
  await fs.writeFile(recordFile(record.id), JSON.stringify(record, null, 2), 'utf-8')

  const index = await loadIndex()
  index.push({
    id: record.id,
    startedAt: record.startedAt,
    durationSec: record.durationSec,
    schoolName: record.schoolName,
    preset: record.preset,
    total: record.total
  })
  await saveIndex(index)
  return record
}

/** 生成 Markdown 报告文本 */
export function buildMarkdown(rec: InterviewReport): string {
  const fmt = (v: number): string => v.toFixed(1)
  const esc = (s: string): string => s.replace(/\|/g, '\\|')
  const lines: string[] = []
  lines.push(`# 面试评分报告`)
  lines.push('')
  lines.push(`- 面试时间：${new Date(rec.startedAt).toLocaleString('zh-CN')}`)
  lines.push(`- 时长：${Math.round(rec.durationSec / 60)} 分钟`)
  if (rec.schoolName) lines.push(`- 目标学校：${esc(rec.schoolName)}`)
  lines.push(`- 总分：**${fmt(rec.total)} / 10**`)
  lines.push('')
  lines.push('## 分项评分')
  const groups: Array<[string, Record<string, number>]> = [
    ['自我介绍', rec.scores.intro],
    ['英语口语', rec.scores.english],
    ['专业课', rec.scores.major],
    ['简历问答', rec.scores.resume]
  ]
  for (const [name, g] of groups) {
    lines.push(`### ${name}`)
    lines.push('')
    lines.push('| 项目 | 得分 |')
    lines.push('|---|---|')
    for (const [k, v] of Object.entries(g)) lines.push(`| ${esc(k)} | ${fmt(v)} |`)
    lines.push('')
  }
  lines.push('## 总体评语')
  lines.push('')
  lines.push(rec.comment)
  lines.push('')
  lines.push('## 改进建议')
  lines.push('')
  rec.suggestions.forEach((s, i) => lines.push(`${i + 1}. ${esc(s)}`))
  lines.push('')
  lines.push('## 问答回放')
  lines.push('')
  for (const m of rec.messages) {
    lines.push(`**${m.role === 'assistant' ? '面试官' : '考生'}**：${m.content.replace(/\n/g, '\n> ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

/** 生成「我的回答汇总」Markdown（面试全记录，重点是我的回答） */
export function buildAnswersMarkdown(rec: InterviewReport): string {
  const esc = (s: string): string => s.replace(/\|/g, '\\|')
  const lines: string[] = []
  lines.push('# 我的面试回答汇总')
  lines.push('')
  lines.push(`- 面试时间：${new Date(rec.startedAt).toLocaleString('zh-CN')}`)
  lines.push(`- 时长：${Math.round(rec.durationSec / 60)} 分钟`)
  if (rec.schoolName) lines.push(`- 目标学校：${esc(rec.schoolName)}`)
  lines.push('')
  for (const m of rec.messages) {
    const label = m.role === 'assistant' ? '**面试官**' : '**我的回答**'
    lines.push(`${label}：${m.content.replace(/\n/g, '\n> ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

/** 保存参考答案到记录 */
export async function saveReferenceAnswers(id: string, md: string): Promise<InterviewReport | null> {
  const rec = await getRecord(id)
  if (!rec) return null
  rec.referenceAnswers = md
  await fs.writeFile(recordFile(id), JSON.stringify(rec, null, 2), 'utf-8')
  return rec
}

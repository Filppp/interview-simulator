import { chatCompletion } from './llm'
import type { ChatMessage, ScoreGroup, SessionToReport } from '../shared/types'

export interface ReportContent {
  scores: ScoreGroup
  comment: string
  suggestions: string[]
}

const SCORE_PROMPT = `你是一名资深的研究生复试模拟面试评估专家。请根据完整面试记录，对考生表现进行客观、中肯的评分。

【评分维度】每项 0-10 分（允许 0.5 分）：
- intro 自我介绍：structure 内容结构 / highlights 亮点突出 / fluency 表达流畅 / timeControl 时长控制
- english 英语口语：fluency 流利度 / pronunciation 发音 / grammar 语法 / content 内容质量 / responsiveness 应变
- major 专业课：accuracy 知识准确性 / logic 逻辑性 / depth 深度 / followupResponse 追问应对
- resume 简历问答：depth 项目理解深度 / consistency 回答一致性 / adaptability 临场应变

【输出要求】
- comment：一段总体评语（120 字以内，指出最主要优势与不足，中肯不浮夸）
- suggestions：3-6 条具体可执行的改进建议，按优先级排序，每条不超过 40 字
- 必须只输出一个 JSON 对象，不要任何其他文字，格式如下：
{"scores":{"intro":{"structure":0,"highlights":0,"fluency":0,"timeControl":0},"english":{"fluency":0,"pronunciation":0,"grammar":0,"content":0,"responsiveness":0},"major":{"accuracy":0,"logic":0,"depth":0,"followupResponse":0},"resume":{"depth":0,"consistency":0,"adaptability":0}},"comment":"","suggestions":[]}`

/** 根据面试记录生成结构化评分 */
export async function generateReportContent(session: SessionToReport): Promise<ReportContent> {
  const recordText = session.messages
    .map((m) => `${m.role === 'assistant' ? '面试官' : '考生'}：${m.content}`)
    .join('\n\n')

  const raw = await chatCompletion(
    [
      { role: 'assistant', content: SCORE_PROMPT },
      { role: 'user', content: `【面试记录】\n${recordText.slice(0, 16000)}` }
    ],
    { maxTokens: 1500, temperature: 0.4, timeoutMs: 120000 }
  )

  const parsed = extractJson(raw)
  const scores = normalizeScores(parsed.scores)
  const comment = typeof parsed.comment === 'string' ? parsed.comment.slice(0, 300) : ''
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((s: unknown): s is string => typeof s === 'string').slice(0, 8)
    : []
  return { scores, comment, suggestions }
}

/** 从模型输出中提取 JSON（容忍代码块围栏与前后杂文） */
function extractJson(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const target = fenced ? fenced[1] : raw
  const start = target.indexOf('{')
  const end = target.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(target.slice(start, end + 1))
      if (obj && typeof obj === 'object') return obj as Record<string, unknown>
    } catch {
      /* fallthrough */
    }
  }
  throw new Error('模型未返回有效的评分 JSON')
}

/** 校验并归一化分数（缺失项补 0） */
function normalizeScores(s: unknown): ScoreGroup {
  const g = (s ?? {}) as Partial<ScoreGroup>
  const num = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(10, Math.max(0, Math.round(n * 10) / 10)) : 0
  }
  const obj = (o: unknown, keys: string[]): Record<string, number> => {
    const base = (o ?? {}) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const k of keys) out[k] = num(base[k])
    return out
  }
  return {
    intro: obj(g.intro, ['structure', 'highlights', 'fluency', 'timeControl']) as ScoreGroup['intro'],
    english: obj(g.english, ['fluency', 'pronunciation', 'grammar', 'content', 'responsiveness']) as ScoreGroup['english'],
    major: obj(g.major, ['accuracy', 'logic', 'depth', 'followupResponse']) as ScoreGroup['major'],
    resume: obj(g.resume, ['depth', 'consistency', 'adaptability']) as ScoreGroup['resume']
  }
}

/** 计算加权总分（各维度等权平均，0-10） */
export function computeTotal(scores: ScoreGroup): number {
  const avg = (o: Record<string, number>): number => {
    const vs = Object.values(o)
    return vs.reduce((a, b) => a + b, 0) / vs.length
  }
  const parts = [avg(scores.intro), avg(scores.english), avg(scores.major), avg(scores.resume)]
  const total = parts.reduce((a, b) => a + b, 0) / parts.length
  return Math.round(total * 10) / 10
}

const REFERENCE_PROMPT = `你是资深的研究生复试辅导老师。下面是考生一次模拟面试的完整记录（面试官/考生交替发言）。

请从中提取面试官提出的每一个问题（包括追问与提示请求），并为每个问题给出高质量参考答案，帮助考生复盘提高。

输出要求（直接输出 Markdown，不要代码块围栏、不要多余说明）：
## 问题 1：<问题原文>
- 答题要点：2-3 条关键点
- 参考答案：2-4 句完整、准确、有条理的回答

（依次列出所有问题；问题较多时全部列出）

面试记录：
"""
%s
"""`

/** 面试结束后：为记录中的每道问题生成参考答案（Markdown） */
export async function generateReferenceAnswers(record: { messages: ChatMessage[] }): Promise<string> {
  const text = record.messages
    .map((m) => `${m.role === 'assistant' ? '面试官' : '考生'}：${m.content}`)
    .join('\n\n')
  const prompt = REFERENCE_PROMPT.replace('%s', text.slice(0, 20000))
  return chatCompletion([{ role: 'assistant', content: prompt }], {
    maxTokens: 4000,
    temperature: 0.5,
    timeoutMs: 180000
  })
}

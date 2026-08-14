import { loadSettings } from './store'
import type { ApiTestResult, ChatMessage } from '../shared/types'

/** OpenAI 兼容的 chat/completions 调用（非流式） */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<string> {
  const s = await loadSettings()
  const key = s.apiKey.trim()
  if (!key) throw new Error('未配置 API Key，请先在设置中填写')

  const base = s.apiBaseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90000)

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: s.model,
        messages,
        max_tokens: opts.maxTokens ?? 600,
        temperature: opts.temperature ?? 0.7,
        stream: false
      }),
      signal: controller.signal
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}：${text.slice(0, 200)}`)
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('模型返回为空')
    return content
  } finally {
    clearTimeout(timer)
  }
}

/** 测试 DeepSeek（OpenAI 兼容）API 连通性。不传 key 时使用已保存的 Key。 */
export async function testApiKey(keyOverride?: string): Promise<ApiTestResult> {
  const s = await loadSettings()
  const key = (keyOverride ?? s.apiKey).trim()
  if (!key) return { ok: false, message: '未配置 API Key，请先在设置中填写' }

  const base = s.apiBaseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: s.model,
        messages: [{ role: 'user', content: '请只回复"连接成功"四个字' }],
        max_tokens: 16,
        stream: false
      }),
      signal: controller.signal
    })
    clearTimeout(timer)

    if (res.ok) {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const reply = data?.choices?.[0]?.message?.content?.trim() ?? '(空回复)'
      return { ok: true, message: `连接成功 · 模型 ${s.model} 回复：${reply.slice(0, 60)}` }
    }
    const text = await res.text().catch(() => '')
    return { ok: false, message: `HTTP ${res.status}：${text.slice(0, 200)}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `请求失败：${msg}` }
  } finally {
    clearTimeout(timer)
  }
}

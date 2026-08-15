import { loadSettings, getActiveProvider } from './store'
import type { ApiTestResult, ChatMessage, ProviderConfig } from '../shared/types'

interface ProviderLike {
  baseUrl: string
  model: string
  apiKey: string
}

/** 将消息序列化为 OpenAI 兼容格式（支持多模态图片） */
function serializeMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    const images = m.images?.filter((i) => i && i.startsWith('data:image')) ?? []
    if (images.length > 0) {
      // 多模态格式：content 为数组
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: m.content }
      ]
      for (const img of images) content.push({ type: 'image_url', image_url: { url: img } })
      return { role: m.role, content }
    }
    return { role: m.role, content: m.content }
  })
}

async function getProvider(): Promise<{ p: ProviderLike; vision: boolean }> {
  const s = await loadSettings()
  const active = getActiveProvider(s)
  if (!active) throw new Error('未配置任何 AI 服务商，请先在设置中添加')
  return { p: { baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey }, vision: active.vision }
}

/** OpenAI 兼容的 chat/completions 调用（非流式，支持多模态） */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<string> {
  const { p } = await getProvider()
  const key = p.apiKey.trim()
  if (!key) throw new Error('当前服务商未填写 API Key，请先在设置中配置')

  const base = p.baseUrl.replace(/\/+$/, '')
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
        model: p.model,
        messages: serializeMessages(messages),
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

/** 测试当前服务商连通性 */
export async function testApiKey(): Promise<ApiTestResult> {
  let provider: ProviderLike
  let name = ''
  try {
    const s = await loadSettings()
    const active = getActiveProvider(s)
    if (!active) return { ok: false, message: '未配置任何 AI 服务商，请先在设置中添加' }
    provider = { baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey }
    name = active.name
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }

  const key = provider.apiKey.trim()
  if (!key) return { ok: false, message: '未填写 API Key，请先在设置中填写' }

  const base = provider.baseUrl.replace(/\/+$/, '')
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
        model: provider.model,
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
      return { ok: true, message: `${name} 连接成功 · ${provider.model} 回复：${reply.slice(0, 60)}` }
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

export type { ProviderConfig }

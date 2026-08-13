import { loadSettings } from './store'
import type { ApiTestResult } from '../shared/types'

/**
 * 测试 DeepSeek（OpenAI 兼容）API 连通性。
 * 不传 key 时使用已保存的 Key。
 */
export async function testApiKey(keyOverride?: string): Promise<ApiTestResult> {
  const s = await loadSettings()
  const key = (keyOverride ?? s.apiKey).trim()
  if (!key) return { ok: false, message: '未配置 API Key，请先在设置中填写' }

  const base = s.apiBaseUrl.replace(/\/+$/, '')
  const url = `${base}/chat/completions`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, {
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

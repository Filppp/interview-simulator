import { createHash, randomUUID } from 'node:crypto'
import { promises as fs, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { dataRoot } from './store'
import type { SpeakResult } from '../shared/types'

const CACHE_SUBDIR = 'audio/tts-cache'

/**
 * Edge TTS 合成语音（中英双语），结果按内容哈希缓存为 mp3。
 * 返回 base64，由渲染进程通过 <audio> 播放。
 */
export async function synthesize(text: string, voice: string, rate: number): Promise<SpeakResult> {
  try {
    if (!text.trim()) return { ok: false, base64: '', mime: 'audio/mpeg', error: '文本为空' }
    const hash = createHash('sha1').update(`${voice}|${rate}|${text}`).digest('hex')
    const dir = path.join(dataRoot(), CACHE_SUBDIR)
    mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${hash}.mp3`)

    if (!existsSync(file)) {
      const tmpDir = path.join(dir, `tmp-${randomUUID()}`)
      mkdirSync(tmpDir, { recursive: true })
      try {
        const tts = new MsEdgeTTS()
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
        const { audioFilePath } = await tts.toFile(tmpDir, text, { rate })
        await fs.rename(audioFilePath, file)
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true })
      }
    }

    const buf = await fs.readFile(file)
    return { ok: true, base64: buf.toString('base64'), mime: 'audio/mpeg' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, base64: '', mime: 'audio/mpeg', error: `语音合成失败：${msg}` }
  }
}

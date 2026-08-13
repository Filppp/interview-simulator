import { promises as fs, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { dataRoot } from './store'

export const MODEL_NAME = 'whisper-small'

/** faster-whisper（CTranslate2）模型文件清单（ModelScope 镜像） */
const MODEL_BASE = 'https://modelscope.cn/models/Systran/faster-whisper-small/resolve/master'

export const MODEL_FILES: Array<{ name: string; url: string; size: number }> = [
  { name: 'model.bin', url: `${MODEL_BASE}/model.bin`, size: 483546902 },
  { name: 'config.json', url: `${MODEL_BASE}/config.json`, size: 2370 },
  { name: 'configuration.json', url: `${MODEL_BASE}/configuration.json`, size: 86 },
  { name: 'tokenizer.json', url: `${MODEL_BASE}/tokenizer.json`, size: 2203239 },
  { name: 'vocabulary.txt', url: `${MODEL_BASE}/vocabulary.txt`, size: 459861 }
]

export const MODEL_TOTAL_BYTES = MODEL_FILES.reduce((s, f) => s + f.size, 0)

export function modelDir(): string {
  return path.join(dataRoot(), 'models', MODEL_NAME)
}

/** 已完整下载的模型文件字节数 */
export async function modelDownloadedBytes(): Promise<number> {
  let total = 0
  for (const f of MODEL_FILES) {
    const p = path.join(modelDir(), f.name)
    if (existsSync(p)) {
      try {
        const st = await fs.stat(p)
        if (st.size === f.size) total += st.size
      } catch {
        /* ignore */
      }
    }
  }
  return total
}

let activeController: AbortController | null = null

export function cancelModelDownload(): void {
  activeController?.abort()
}

/**
 * 下载模型（支持断点续传 + 停滞检测 + 重试）。
 * onProgress(downloadedBytes, totalBytes) 增量回调。
 */
export async function downloadModelFiles(
  onProgress: (done: number, total: number) => void
): Promise<void> {
  const dir = modelDir()
  mkdirSync(dir, { recursive: true })
  const controller = new AbortController()
  activeController = controller
  let done = 0

  try {
    for (const f of MODEL_FILES) {
      const dest = path.join(dir, f.name)
      if (existsSync(dest) && (await fs.stat(dest)).size === f.size) {
        done += f.size
        continue
      }
      await downloadOne(f.url, dest, f.size, controller.signal, (n) => {
        done += n
        onProgress(done, MODEL_TOTAL_BYTES)
      })
    }
  } finally {
    activeController = null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 单文件断点续传下载；连续 3 次中断则报错 */
async function downloadOne(
  url: string,
  dest: string,
  expectedSize: number,
  signal: AbortSignal,
  onBytes: (n: number) => void
): Promise<void> {
  const part = dest + '.part'
  let size = existsSync(part) ? (await fs.stat(part)).size : 0
  let stalls = 0

  while (true) {
    if (signal.aborted) throw new Error('下载已取消')
    const ac = new AbortController()
    const forwardAbort = (): void => ac.abort()
    signal.addEventListener('abort', forwardAbort)

    let lastProgress = Date.now()
    // 停滞检测：40 秒无数据则断开重连
    const stallTimer = setInterval(() => {
      if (Date.now() - lastProgress > 40000) ac.abort()
    }, 5000)

    try {
      const res = await fetch(url, {
        headers: { Range: `bytes=${size}-` },
        signal: ac.signal
      })
      if (res.status === 416) {
        // 已超出范围：文件其实已完整
        if (size >= expectedSize) {
          await fs.rename(part, dest)
          return
        }
        throw new Error(`Range 416 (size=${size})`)
      }
      if (res.status !== 200 && res.status !== 206) throw new Error(`HTTP ${res.status}`)

      // 服务器忽略 Range 时从头开始
      if (res.status === 200 && size > 0) {
        size = 0
        await fs.writeFile(part, Buffer.alloc(0))
      }

      const reader = res.body!.getReader()
      const fd = await fs.open(part, 'a')
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await fd.write(value)
          size += value.length
          lastProgress = Date.now()
          onBytes(value.length)
        }
      } finally {
        await fd.close()
      }

      clearInterval(stallTimer)
      signal.removeEventListener('abort', forwardAbort)

      if (size < expectedSize) throw new Error(`下载不完整（${size}/${expectedSize}）`)
      await fs.rename(part, dest)
      return
    } catch (e) {
      clearInterval(stallTimer)
      signal.removeEventListener('abort', forwardAbort)
      if (signal.aborted) throw new Error('下载已取消')
      stalls++
      if (stalls >= 3) {
        throw new Error('网络不稳定，连续 3 次下载中断，请检查网络后重试')
      }
      await sleep(2000 * stalls)
    }
  }
}

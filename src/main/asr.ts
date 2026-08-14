import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promises as fs, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { dataRoot } from './store'
import {
  MODEL_NAME,
  MODEL_TOTAL_BYTES,
  modelDir,
  modelDownloadedBytes,
  downloadModelFiles,
  cancelModelDownload
} from './model-download'
import type { AsrProgress, AsrStatus, TranscribeResult } from '../shared/types'

const VENV_NAME = 'venv-whisper'
const WORKER_NAME = 'whisper-worker.py'
const PIP_MIRROR = 'https://pypi.tuna.tsinghua.edu.cn/simple'

function venvDir(): string {
  return path.join(dataRoot(), VENV_NAME)
}

function pythonBin(): string {
  return path.join(venvDir(), 'bin', 'python')
}

function workerFile(): string {
  return path.join(dataRoot(), WORKER_NAME)
}

/** 内嵌的 Whisper 常驻进程脚本：stdin 读 JSON 指令，stdout 写 JSON 结果 */
const WORKER_SCRIPT = String.raw`#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""whisper-worker: 常驻进程，stdin 读 JSON 指令，stdout 写 JSON 结果"""
import json, sys, argparse, traceback

def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + '\n')
    sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='')
    parser.add_argument('--threads', type=int, default=4)
    args = parser.parse_args()
    model = None

    def ensure_model():
        nonlocal model
        if model is None:
            from faster_whisper import WhisperModel
            model = WhisperModel(args.model, device='cpu', compute_type='int8',
                                 cpu_threads=args.threads)
            emit({'type': 'ready'})

    ensure_model()  # 启动即加载模型（常驻进程，只加载一次）

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            cmd = req.get('cmd')
            if cmd == 'ping':
                emit({'type': 'pong'})
            elif cmd == 'transcribe':
                ensure_model()
                segments, info = model.transcribe(
                    req['path'],
                    language=req.get('language') or None,
                    vad_filter=True,
                    beam_size=5
                )
                text = ''.join(seg.text for seg in segments).strip()
                emit({'type': 'result', 'id': req.get('id'), 'text': text,
                      'language': info.language, 'duration': info.duration})
            elif cmd == 'exit':
                break
        except Exception as e:
            emit({'type': 'error', 'id': req.get('id'), 'message': str(e),
                  'trace': traceback.format_exc()[-800:]})

if __name__ == '__main__':
    main()
`

/** 常驻 Whisper 进程管理器（模型只加载一次） */
class WhisperWorker {
  private proc: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<string, { resolve: (v: TranscribeResult) => void; reject: (e: Error) => void }>()
  private buffer = ''
  private seq = 0
  private starting: Promise<void> | null = null

  async ready(): Promise<void> {
    if (this.proc && this.proc.exitCode === null) return
    if (this.starting) return this.starting
    this.starting = this.start()
    try {
      await this.starting
    } finally {
      this.starting = null
    }
  }

  private start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!existsSync(pythonBin())) {
        reject(new Error('识别引擎未安装'))
        return
      }
      mkdirSync(dataRoot(), { recursive: true })
      const proc = spawn(pythonBin(), [workerFile(), '--model', modelDir()], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      })
      this.proc = proc
      let started = false

      proc.stdout.on('data', (d: Buffer) => {
        this.buffer += d.toString('utf-8')
        let idx: number
        while ((idx = this.buffer.indexOf('\n')) >= 0) {
          const line = this.buffer.slice(0, idx).trim()
          this.buffer = this.buffer.slice(idx + 1)
          if (!line) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'ready' && !started) {
              started = true
              resolve()
            } else if (msg.type === 'result') {
              const p = this.pending.get(String(msg.id))
              if (p) {
                this.pending.delete(String(msg.id))
                p.resolve({
                  ok: true,
                  text: msg.text ?? '',
                  language: msg.language ?? null,
                  duration: msg.duration ?? 0
                })
              }
            } else if (msg.type === 'error') {
              const detail = msg.trace ? `\n${msg.trace}` : ''
              const errText = `${msg.message ?? '识别失败'}${detail}`
              const p = this.pending.get(String(msg.id ?? 'worker'))
              if (p) {
                this.pending.delete(String(msg.id ?? 'worker'))
                p.reject(new Error(errText))
              } else if (!started) {
                started = true
                reject(new Error(errText))
              }
            } else if (msg.type === 'pong') {
              /* 心跳 */
            }
          } catch {
            /* 忽略非 JSON 行 */
          }
        }
      })

      proc.stderr.on('data', (d: Buffer) => {
        const s = d.toString('utf-8').trim()
        if (s) {
          console.error('[whisper-worker]', s)
          void appendLog(s)
        }
      })

      proc.on('error', (e) => {
        if (!started) {
          started = true
          reject(e)
        }
      })

      proc.on('exit', (code) => {
        this.proc = null
        if (!started) {
          started = true
          reject(new Error(`识别进程退出（code=${code}）`))
        } else {
          for (const p of this.pending.values()) p.reject(new Error('识别进程意外退出'))
          this.pending.clear()
        }
      })

      // 启动超时 60s（模型加载可能较慢）
      setTimeout(() => {
        if (!started) {
          started = true
          reject(new Error('识别进程启动超时'))
          proc.kill()
        }
      }, 60000).unref()
    })
  }

  transcribe(audioPath: string, language?: string): Promise<TranscribeResult> {
    return new Promise((resolve, reject) => {
      void this.ready()
        .then(() => {
          if (!this.proc) {
            reject(new Error('识别进程不可用'))
            return
          }
          const id = String(++this.seq)
          this.pending.set(id, { resolve, reject })
          this.proc.stdin.write(JSON.stringify({ cmd: 'transcribe', id, path: audioPath, language }) + '\n')
          // 单次识别超时 120s
          setTimeout(() => {
            const p = this.pending.get(id)
            if (p) {
              this.pending.delete(id)
              p.reject(new Error('识别超时（120s）'))
            }
          }, 120000).unref()
        })
        .catch(reject)
    })
  }

  async close(): Promise<void> {
    if (this.proc && this.proc.exitCode === null) {
      this.proc.stdin.write(JSON.stringify({ cmd: 'exit' }) + '\n')
      await new Promise((r) => setTimeout(r, 300))
      this.proc.kill()
    }
    this.proc = null
  }
}

let worker: WhisperWorker | null = null

function getWorker(): WhisperWorker {
  if (!worker) worker = new WhisperWorker()
  return worker
}

/** 引擎是否安装（venv + faster-whisper） */
export async function engineReady(): Promise<boolean> {
  if (!existsSync(pythonBin())) return false
  try {
    await fs.access(workerFile())
  } catch {
    return false
  }
  return true
}

export async function getAsrStatus(): Promise<AsrStatus> {
  const [eng, dl] = await Promise.all([engineReady(), modelDownloadedBytes()])
  return {
    engineReady: eng,
    modelReady: dl >= MODEL_TOTAL_BYTES,
    modelName: MODEL_NAME,
    modelDir: modelDir(),
    modelTotalBytes: MODEL_TOTAL_BYTES,
    modelDownloadedBytes: dl
  }
}

/** 安装识别引擎（创建 venv + pip 安装 faster-whisper + 写入 worker 脚本） */
export async function setupEngine(onProgress: (p: AsrProgress) => void): Promise<void> {
  const root = dataRoot()
  mkdirSync(root, { recursive: true })

  if (!existsSync(pythonBin())) {
    onProgress({ phase: 'venv', message: '正在创建 Python 虚拟环境…', done: 0, total: 0, speedBps: 0 })
    await runProcess('python3', ['-m', 'venv', venvDir()])
  }

  // 写入 worker 脚本
  await fs.writeFile(workerFile(), WORKER_SCRIPT, 'utf-8')

  // 检查 faster-whisper 是否已装
  const installed = await checkImport()
  if (!installed) {
    onProgress({ phase: 'pip', message: '正在安装 faster-whisper（约 100MB，请稍候）…', done: 0, total: 0, speedBps: 0 })
    await runProcess(
      pythonBin(),
      ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--index-url', PIP_MIRROR, 'faster-whisper']
    )
  }

  const ok = await checkImport()
  if (!ok) throw new Error('faster-whisper 安装后验证失败')
  onProgress({ phase: 'verify', message: '识别引擎就绪', done: 0, total: 0, speedBps: 0 })
}

/** 下载 whisper 模型 */
export async function downloadModel(onProgress: (p: AsrProgress) => void): Promise<void> {
  let lastDone = 0
  let lastTime = Date.now()
  await downloadModelFiles((done, total) => {
    const now = Date.now()
    const dt = (now - lastTime) / 1000
    const speedBps = dt > 0 ? Math.max(0, (done - lastDone) / dt) : 0
    lastDone = done
    lastTime = now
    const pct = total > 0 ? done / total : 0
    onProgress({
      phase: 'download',
      message: `正在下载模型 ${(pct * 100).toFixed(1)}%（${(done / 1048576).toFixed(1)}/${(total / 1048576).toFixed(0)} MB）`,
      done,
      total,
      speedBps
    })
  })
}

export { cancelModelDownload }

async function checkImport(): Promise<boolean> {
  try {
    const { stdout } = await execCapture(pythonBin(), ['-c', 'import faster_whisper; print(faster_whisper.__version__)'])
    return stdout.includes('.')
  } catch {
    return false
  }
}

async function runProcess(cmd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    p.stdout.on('data', () => {})
    p.stderr.on('data', () => {})
    p.on('error', reject)
    p.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args[0] ?? ''} 退出码 ${code}`))
    })
  })
}

function execCapture(cmd: string, args: string[]): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args)
    let out = ''
    p.stdout.on('data', (d: Buffer) => (out += d.toString()))
    p.on('error', reject)
    p.on('exit', (code) => {
      if (code === 0) resolve({ stdout: out })
      else reject(new Error(`exit ${code}`))
    })
  })
}

/** 识别一段音频（webm/wav/mp3 均可，PyAV 解码）。language 为空则自动检测 */
export async function transcribeAudio(
  webmBase64: string,
  language?: string
): Promise<TranscribeResult> {
  const eng = await engineReady()
  if (!eng) {
    return { ok: false, text: '', language: null, duration: 0, error: '识别引擎未安装，请先在设置中安装' }
  }
  const status = await getAsrStatus()
  if (!status.modelReady) {
    return {
      ok: false,
      text: '',
      language: null,
      duration: 0,
      error: `语音模型未下载（${(status.modelDownloadedBytes / 1048576).toFixed(1)}/${(status.modelTotalBytes / 1048576).toFixed(0)} MB），请先在设置中下载`
    }
  }

  try {
    const audioDir = path.join(dataRoot(), 'audio')
    mkdirSync(audioDir, { recursive: true })
    const file = path.join(audioDir, `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webm`)
    await fs.writeFile(file, Buffer.from(webmBase64, 'base64'))
    const result = await getWorker().transcribe(file, language)
    await fs.unlink(file).catch(() => {})
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, text: '', language: null, duration: 0, error: `识别失败：${msg}` }
  }
}

/** 应用退出时关闭识别进程 */
export async function closeWhisper(): Promise<void> {
  if (worker) await worker.close()
}

/** 追加 whisper 日志到文件（排查用） */
let logPath: string | null = null
async function appendLog(line: string): Promise<void> {
  try {
    if (!logPath) {
      mkdirSync(path.join(dataRoot(), 'logs'), { recursive: true })
      logPath = path.join(dataRoot(), 'logs', 'whisper-worker.log')
    }
    await fs.appendFile(logPath, `[${new Date().toISOString()}] ${line}\n`, 'utf-8')
  } catch {
    /* 忽略日志写入错误 */
  }
}

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export interface ParseResult {
  text: string
  pageCount: number | null
}

const SUPPORTED_EXTS = ['.pdf', '.docx', '.txt', '.md']

export function isSupportedFile(filePath: string): boolean {
  return SUPPORTED_EXTS.includes(path.extname(filePath).toLowerCase())
}

/** 解析 PDF / Word / 纯文本文件为纯文本 */
export async function parseFile(absPath: string): Promise<ParseResult> {
  const ext = path.extname(absPath).toLowerCase()

  if (ext === '.pdf') {
    const buf = await fs.readFile(absPath)
    const parser = new PDFParse({ data: new Uint8Array(buf) })
    const result = await parser.getText()
    return {
      text: (result.text ?? '').replace(/\u0000/g, ''),
      pageCount: result.pages?.length ?? null
    }
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: absPath })
    return { text: result.value, pageCount: null }
  }

  if (ext === '.txt' || ext === '.md') {
    const text = await fs.readFile(absPath, 'utf-8')
    return { text, pageCount: null }
  }

  throw new Error(`不支持的文件格式：${ext || '(无扩展名)'}`)
}

/** 读取文本缓存（导入时生成 *.txt），不存在则重新解析 */
export async function readTextCached(storedPath: string): Promise<string> {
  const cache = `${storedPath}.txt`
  try {
    return await fs.readFile(cache, 'utf-8')
  } catch {
    const { text } = await parseFile(storedPath)
    await fs.writeFile(cache, text, 'utf-8').catch(() => {})
    return text
  }
}

/** 写文本缓存（静默失败不阻塞导入） */
export async function writeTextCache(storedPath: string, text: string): Promise<void> {
  await fs.writeFile(`${storedPath}.txt`, text, 'utf-8').catch(() => {})
}

import { randomUUID } from 'node:crypto'
import { promises as fs, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { dataRoot } from './store'
import { parseFile, readTextCached, writeTextCache, isSupportedFile } from './parser'
import type { MaterialCategory, MaterialDetail, MaterialMeta } from '../shared/types'

export const CATEGORY_DIRS: Record<MaterialCategory, string> = {
  english: 'materials/english',
  major: 'materials/major',
  resume: 'resume'
}

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  english: '英语资料',
  major: '专业课资料',
  resume: '简历'
}

function indexFile(): string {
  return path.join(dataRoot(), 'materials-index.json')
}

async function loadIndex(): Promise<MaterialMeta[]> {
  try {
    const raw = await fs.readFile(indexFile(), 'utf-8')
    const arr = JSON.parse(raw) as MaterialMeta[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

async function saveIndex(index: MaterialMeta[]): Promise<void> {
  const tmp = indexFile() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(index, null, 2), 'utf-8')
  await fs.rename(tmp, indexFile())
}

export async function listMaterials(category?: MaterialCategory): Promise<MaterialMeta[]> {
  const all = await loadIndex()
  const sorted = all.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  return category ? sorted.filter((m) => m.category === category) : sorted
}

/** 启动时若索引缺失，扫描目录重建 */
export async function ensureIndex(): Promise<void> {
  if (existsSync(indexFile())) return
  const index: MaterialMeta[] = []
  for (const [category, rel] of Object.entries(CATEGORY_DIRS)) {
    const dir = path.join(dataRoot(), rel)
    if (!existsSync(dir)) continue
    for (const name of await fs.readdir(dir)) {
      const storedPath = path.join(dir, name)
      if (!isSupportedFile(storedPath)) continue
      const stat = await fs.stat(storedPath)
      index.push(await buildMeta(storedPath, name, category as MaterialCategory, stat.size))
    }
  }
  await saveIndex(index)
}

/** 将文件复制进资料目录并解析入库，返回新增的记录 */
export async function addMaterials(
  filePaths: string[],
  category: MaterialCategory
): Promise<MaterialMeta[]> {
  const index = await loadIndex()
  const added: MaterialMeta[] = []
  const destDir = path.join(dataRoot(), CATEGORY_DIRS[category])
  mkdirSync(destDir, { recursive: true })

  for (const src of filePaths) {
    if (!isSupportedFile(src)) continue
    const base = path.basename(src)
    let dest = path.join(destDir, base)
    if (existsSync(dest)) dest = path.join(destDir, `${Date.now()}-${base}`)
    try {
      await fs.copyFile(src, dest)
      const stat = await fs.stat(dest)
      const meta = await buildMeta(dest, base, category, stat.size)
      index.push(meta)
      added.push(meta)
    } catch (e) {
      // 复制失败则不留脏文件
      await fs.unlink(dest).catch(() => {})
      throw new Error(`导入 ${base} 失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  await saveIndex(index)
  return added
}

async function buildMeta(
  storedPath: string,
  name: string,
  category: MaterialCategory,
  sizeBytes: number
): Promise<MaterialMeta> {
  const base: MaterialMeta = {
    id: randomUUID(),
    name,
    storedPath,
    category,
    ext: path.extname(storedPath).slice(1).toLowerCase(),
    sizeBytes,
    pageCount: null,
    charCount: 0,
    addedAt: new Date().toISOString(),
    status: 'ok'
  }
  try {
    const { text, pageCount } = await parseFile(storedPath)
    await writeTextCache(storedPath, text)
    return { ...base, pageCount, charCount: text.length }
  } catch (e) {
    return { ...base, status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

export async function removeMaterial(id: string): Promise<void> {
  const index = await loadIndex()
  const target = index.find((m) => m.id === id)
  if (!target) return
  await fs.unlink(target.storedPath).catch(() => {})
  await fs.unlink(target.storedPath + '.txt').catch(() => {})
  await saveIndex(index.filter((m) => m.id !== id))
}

export async function getMaterialDetail(id: string): Promise<MaterialDetail | null> {
  const index = await loadIndex()
  const meta = index.find((m) => m.id === id)
  if (!meta) return null
  const text = await readTextCached(meta.storedPath)
  return { meta, text }
}

import { randomUUID } from 'node:crypto'
import { promises as fs, mkdirSync } from 'node:fs'
import path from 'node:path'
import { dataRoot } from './store'
import { parseFile, isSupportedFile } from './parser'
import type { SchoolProfile } from '../shared/types'

function schoolsFile(): string {
  return path.join(dataRoot(), 'schools.json')
}

async function loadSchools(): Promise<SchoolProfile[]> {
  try {
    const raw = await fs.readFile(schoolsFile(), 'utf-8')
    const arr = JSON.parse(raw) as SchoolProfile[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

async function saveSchools(list: SchoolProfile[]): Promise<void> {
  const tmp = schoolsFile() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf-8')
  await fs.rename(tmp, schoolsFile())
}

export async function listSchools(): Promise<SchoolProfile[]> {
  const list = await loadSchools()
  return list.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

export async function saveSchool(
  input: { id?: string; name: string; target: string; notes: string[] }
): Promise<SchoolProfile> {
  const list = await loadSchools()
  const now = new Date().toISOString()
  if (input.id) {
    const idx = list.findIndex((s) => s.id === input.id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], name: input.name, target: input.target, notes: input.notes }
      await saveSchools(list)
      return list[idx]
    }
  }
  const profile: SchoolProfile = {
    id: randomUUID(),
    name: input.name,
    target: input.target,
    notes: input.notes.filter((n) => n.trim()),
    files: [],
    addedAt: now
  }
  list.push(profile)
  await saveSchools(list)
  return profile
}

export async function removeSchool(id: string): Promise<void> {
  const list = await loadSchools()
  await saveSchools(list.filter((s) => s.id !== id))
}

/** 导入文件：解析文本并追加到该校笔记 */
export async function importSchoolFiles(
  schoolId: string,
  filePaths: string[]
): Promise<SchoolProfile | null> {
  const list = await loadSchools()
  const school = list.find((s) => s.id === schoolId)
  if (!school) return null

  mkdirSync(path.join(dataRoot(), 'school-files'), { recursive: true })
  for (const src of filePaths) {
    if (!isSupportedFile(src)) continue
    try {
      const { text } = await parseFile(src)
      const trimmed = text.trim()
      if (!trimmed) continue
      school.notes.push(`【文件：${path.basename(src)}】\n${trimmed.slice(0, 8000)}`)
      school.files.push(path.basename(src))
    } catch {
      /* 单个文件失败不影响其他 */
    }
  }
  await saveSchools(list)
  return school
}

/** 取某学校的风格笔记（截断） */
export async function getSchoolNotes(id: string, maxChars = 4000): Promise<string> {
  const list = await loadSchools()
  const school = list.find((s) => s.id === id)
  if (!school) return ''
  const joined = school.notes.join('\n\n').trim()
  return joined.slice(0, maxChars)
}

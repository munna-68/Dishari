import { MONTH_NAMES, isValidIso, pad2, parseLooseDate } from './date'
import type { Holiday } from './working-days'

export interface ParsedHolidayRow {
  /** Stable key for list rendering and checkbox selection. */
  key: string
  /** Present when the row could be understood at all. */
  date: string | null
  nameEn: string
  nameBn: string
  tentative: boolean
  valid: boolean
  error: string | null
  /** The raw shape the parser accepted, useful when debugging a bad paste. */
  rawDate: string
}

const DATE_KEYS = [
  'date',
  'isoDate',
  'iso_date',
  'iso',
  'dateISO',
  'day',
  'startDate',
  'start_date',
  'd',
]

const NAME_EN_KEYS = [
  'name',
  'nameEn',
  'name_en',
  'englishName',
  'english_name',
  'english',
  'en',
  'title',
  'event',
  'holiday',
  'holidayName',
  'holiday_name',
  'description',
]

const NAME_BN_KEYS = [
  'nameBn',
  'name_bn',
  'nameBangla',
  'name_bangla',
  'bengaliName',
  'bengali_name',
  'bangla',
  'bn',
  'bnName',
  'bn_name',
]

const TENTATIVE_KEYS = [
  'tentative',
  'isTentative',
  'is_tentative',
  'tentativeFlag',
  'tentative_flag',
  'approx',
  'approximate',
  'estimated',
  'isApprox',
  'provisional',
]

const HOLIDAY_LIST_KEYS = ['holidays', 'holidayList', 'holiday_list', 'list', 'items', 'data', 'dates']

function readString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function readBoolean(source: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase()
      if (['true', 'yes', 'y', '1', 'tentative', 'approx'].includes(lowered)) return true
      if (['false', 'no', 'n', '0', 'confirmed', 'fixed'].includes(lowered)) return false
    }
    if (typeof value === 'number') return value !== 0
  }
  return false
}

/** Strips markdown fences and the prose an assistant tends to wrap around JSON. */
export function stripJsonFences(input: string): string {
  let text = input.trim()
  const fence = /```[a-zA-Z]*\s*([\s\S]*?)```/
  const fenced = fence.exec(text)
  if (fenced && fenced[1] !== undefined) {
    text = fenced[1].trim()
  }
  text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '')
  return text.trim()
}

function extractJsonCandidate(text: string): string | null {
  const trimmed = stripJsonFences(text)
  if (!trimmed) return null
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed

  const objectStart = trimmed.indexOf('{')
  const arrayStart = trimmed.indexOf('[')
  const candidates: Array<{ start: number; open: '{' | '['; close: '}' | ']' }> = []
  if (objectStart >= 0) candidates.push({ start: objectStart, open: '{', close: '}' })
  if (arrayStart >= 0) candidates.push({ start: arrayStart, open: '[', close: ']' })
  candidates.sort((a, b) => a.start - b.start)

  for (const candidate of candidates) {
    const slice = balancedSlice(trimmed, candidate.start, candidate.open, candidate.close)
    if (slice) {
      try {
        JSON.parse(slice)
        return slice
      } catch {
        /* try the next candidate */
      }
    }
  }
  return null
}

function balancedSlice(text: string, start: number, open: string, close: string): string | null {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return null
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normaliseDateValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asDate = new Date(value)
    if (!Number.isNaN(asDate.getTime())) {
      return `${asDate.getFullYear()}-${pad2(asDate.getMonth() + 1)}-${pad2(asDate.getDate())}`
    }
  }
  return ''
}

/** Turns one entry of whatever shape the AI produced into a reviewable row. */
function toRow(value: unknown, index: number): ParsedHolidayRow {
  const blank: ParsedHolidayRow = {
    key: `row-${index}`,
    date: null,
    nameEn: '',
    nameBn: '',
    tentative: false,
    valid: false,
    error: null,
    rawDate: '',
  }

  if (typeof value === 'string') {
    const parsed = parseLooseDate(value)
    return {
      ...blank,
      date: parsed,
      nameEn: parsed ? value : value.trim(),
      rawDate: value.trim(),
      valid: parsed !== null,
      error: parsed ? null : `Could not read "${value}" as a date.`,
    }
  }

  if (!isRecord(value)) {
    return { ...blank, error: 'Entry is not an object or a date string.' }
  }

  const rawDate = normaliseDateValue(readString(value, DATE_KEYS))
  const nameEn = readString(value, NAME_EN_KEYS)
  const nameBn = readString(value, NAME_BN_KEYS)
  const tentative = readBoolean(value, TENTATIVE_KEYS)

  if (!rawDate) {
    return { ...blank, nameEn, nameBn, tentative, error: 'No date field was found.' }
  }

  const parsed = parseLooseDate(rawDate)
  if (!parsed) {
    return { ...blank, nameEn, nameBn, tentative, rawDate, error: `"${rawDate}" is not a valid date.` }
  }
  if (!isValidIso(parsed)) {
    return { ...blank, nameEn, nameBn, tentative, rawDate, error: `"${rawDate}" is not a real calendar date.` }
  }

  return {
    key: `row-${index}-${parsed}`,
    date: parsed,
    nameEn: nameEn || 'Holiday',
    nameBn,
    tentative,
    valid: true,
    error: null,
    rawDate,
  }
}

function findList(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed
  if (isRecord(parsed)) {
    for (const key of HOLIDAY_LIST_KEYS) {
      const value = parsed[key]
      if (Array.isArray(value)) return value
    }
    // Date-keyed object: { "2026-10-04": "Eid-ul-Fitr" }
    const dateKeyed = Object.entries(parsed).filter(([key]) => isValidIso(key))
    if (dateKeyed.length > 0) {
      return dateKeyed.map(([date, value]) =>
        typeof value === 'string' ? { date, name: value } : { date, ...(isRecord(value) ? value : {}) },
      )
    }
    // A single holiday object.
    if (readString(parsed, DATE_KEYS) !== '') return [parsed]
  }
  return null
}

/**
 * Tolerant parser for whatever an AI (or a human) pasted. Returns one row per
 * entry so the review step can show valid and invalid rows side by side.
 */
export function parseHolidayInput(input: string): ParsedHolidayRow[] {
  const text = stripJsonFences(input)
  if (!text) return []

  const candidate = extractJsonCandidate(text)
  if (!candidate) return [{ ...invalidRow(0), error: 'No JSON object or array was found in the text.' }]

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON error'
    return [{ ...invalidRow(0), error: `The JSON could not be parsed: ${message}` }]
  }

  const list = findList(parsed)
  if (!list || list.length === 0) {
    return [{ ...invalidRow(0), error: 'No holiday list was found in the JSON.' }]
  }

  return list.map(toRow)
}

function invalidRow(index: number): ParsedHolidayRow {
  return {
    key: `row-${index}`,
    date: null,
    nameEn: '',
    nameBn: '',
    tentative: false,
    valid: false,
    error: null,
    rawDate: '',
  }
}

export function rowsToHolidays(rows: ParsedHolidayRow[]): Record<string, Holiday> {
  const result: Record<string, Holiday> = {}
  for (const row of rows) {
    if (!row.valid || !row.date) continue
    result[row.date] = toHoliday(row)
  }
  return result
}

export function toHoliday(row: ParsedHolidayRow): Holiday {
  const holiday: Holiday = { source: 'imported', nameEn: row.nameEn.trim() || 'Holiday' }
  if (row.nameBn.trim()) holiday.nameBn = row.nameBn.trim()
  if (row.tentative) holiday.tentative = true
  return holiday
}

/** Keeps the richer of the two names so an import never blanks a manual name. */
export function mergeHoliday(existing: Holiday | undefined, incoming: Holiday): Holiday {
  if (!existing) return incoming
  if (existing.source === 'manual') return existing
  return incoming
}

export interface PromptScope {
  kind: 'month' | 'year'
  year: number
  month: number
}

export function describePromptScope(scope: PromptScope): string {
  if (scope.kind === 'year') return `the whole year ${scope.year}`
  return `${MONTH_NAMES[scope.month - 1] ?? ''} ${scope.year}`
}

/**
 * The ready-to-paste prompt. It has to make the assistant answer with JSON only,
 * list multi-day holidays day by day, keep Friday/Saturday holidays, flag
 * moon-sighting-dependent dates, and describe the shape in words.
 */
export function buildHolidayPrompt(scope: PromptScope): string {
  return `Find the official Bangladesh government general holiday list (সরকারি ছুটি) for ${describePromptScope(scope)}. Use official sources such as the Cabinet Division, the Bangladesh Gazette, or the Ministry of Public Administration holiday notices, and cross-check more than one source.

Rules:
1. List every single day of a multi-day holiday as its own separate date. Never write "12-15 April" as one entry.
2. Include holidays that fall on a Friday or Saturday. Do not drop them because they are the weekend.
3. Mark holidays whose exact date depends on moon sighting (চাঁদিন্ধানসম্পর্কিত) as tentative, for example Eid-ul-Fitr, Eid-ul-Adha and Shab-e-Barat.
4. Give each holiday an English name and the Bengali name in Bengali script.
5. Reply with JSON only. No commentary, no explanation, no markdown code fences.

The JSON must be a single top-level object with a numeric "year" field and a "holidays" field that is a list. Each item in that list must have a "date" field holding the date written as year-month-day with zero padding (for example "2026-04-12"), a "name" field holding the English name, a "nameBn" field holding the Bengali name, and an optional "tentative" field holding true or false.

Example of the exact shape to produce:
{"year": 2026, "holidays": [{"date": "2026-02-15", "name": "Martyrs' Day", "nameBn": "শহীদ দিবস", "tentative": false}, {"date": "2026-03-21", "name": "Eid-ul-Fitr", "nameBn": "ঈদুল ফিতর", "tentative": true}]}`
}
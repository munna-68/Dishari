import { compareIso, isValidIso, monthBounds, parseMonthKey, toMonthKey } from './date'
import type { DateRange } from './date-format'
import {
  DEFAULT_ACTIVITIES,
  DEFAULT_BRANCHES,
  DEFAULT_PERMANENT_ROSTER,
  MAX_RECENT_BRANCH_NAMES,
  MAX_RECENT_TEMPORARY_NAMES,
  SCHEMA_VERSION,
  defaultSettings,
  emptyAssignment,
  type AppSettings,
  type Assignment,
  type MonthSchedule,
  type Officer,
  type WindowKey,
} from './schema'
import type { Holiday, HolidayContext, HolidayState } from './working-days'

export const STORAGE_KEYS = {
  meta: 'msp:meta',
  settings: 'msp:settings',
  holidays: 'msp:holidays',
  monthPrefix: 'msp:month:',
} as const

export const MONTH_KEY_PATTERN = /^msp:month:(\d{4}-\d{2})$/

export const BACKUP_FORMAT = 'monitoring-schedule-planner-backup'
export const BACKUP_VERSION = 1

export interface MetaRecord {
  schemaVersion: number
}

export function emptyHolidayState(): HolidayState {
  return { schemaVersion: SCHEMA_VERSION, holidays: {}, workingOverrides: {} }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function numberArrayOr(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback
  const cleaned = value.filter((entry): entry is number => typeof entry === 'number' && entry >= 0 && entry <= 6)
  return cleaned.length > 0 ? Array.from(new Set(cleaned)).sort((a, b) => a - b) : fallback
}

function stringArrayOr(value: unknown, fallback: string[], limit: number): string[] {
  if (!Array.isArray(value)) return fallback
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .slice(0, limit)
}

function rangeOr(value: unknown, fallback: DateRange): DateRange {
  if (Array.isArray(value) && value.length === 2) {
    const [start, end] = value
    if (isValidIso(start) && isValidIso(end)) return { start, end }
  }
  if (isRecord(value)) {
    const start = value.start
    const end = value.end
    if (isValidIso(start) && isValidIso(end)) return { start, end }
  }
  return fallback
}

function readRanges(value: unknown): DateRange[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => rangeOr(entry, { start: '', end: '' }))
    .filter((entry) => isValidIso(entry.start) && isValidIso(entry.end))
}

export interface MigrationResult<T> {
  data: T
  fromVersion: number
  toVersion: number
  migrated: boolean
  warnings: string[]
}

function versionOf(raw: unknown): number {
  if (!isRecord(raw)) return 0
  const value = raw.schemaVersion ?? raw.version
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Version 1 kept holidays as a plain `date -> name` map, weekly off days as
 * day names, and months with a flat `w1`/`w2` shape. Version 2 is the current
 * shape, so upgrading means filling in the missing pieces.
 */
function upgradeSettingsV1toV2(raw: Record<string, unknown>, base: AppSettings): AppSettings {
  const dayNames: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }

  let weeklyOffDays = base.weeklyOffDays
  const legacyOffDays = raw.offDays
  if (Array.isArray(legacyOffDays)) {
    const mapped = legacyOffDays
      .map((entry) => (typeof entry === 'string' ? dayNames[entry.trim().toLowerCase()] : undefined))
      .filter((entry): entry is number => typeof entry === 'number')
    if (mapped.length > 0) weeklyOffDays = Array.from(new Set(mapped)).sort((a, b) => a - b)
  }

  const roster = stringArrayOr(raw.permanentRoster, base.defaultPermanentRoster, 40)

  return {
    ...base,
    schemaVersion: 2,
    organization: stringOr(raw.org, base.organization),
    department: stringOr(raw.department, base.department),
    program: stringOr(raw.program, base.program),
    weeklyOffDays,
    defaultPermanentRoster: roster,
    recentTemporaryNames: stringArrayOr(
      raw.recentTempNames,
      base.recentTemporaryNames,
      MAX_RECENT_TEMPORARY_NAMES,
    ),
    recentBranchNames: stringArrayOr(raw.recentBranches, base.recentBranchNames, MAX_RECENT_BRANCH_NAMES),
  }
}

export function migrateSettings(raw: unknown): MigrationResult<AppSettings> {
  const base = defaultSettings()
  if (!isRecord(raw)) {
    return { data: base, fromVersion: 0, toVersion: SCHEMA_VERSION, migrated: false, warnings: [] }
  }

  const fromVersion = versionOf(raw)
  if (fromVersion > SCHEMA_VERSION) {
    return {
      data: base,
      fromVersion,
      toVersion: SCHEMA_VERSION,
      migrated: false,
      warnings: ['Stored settings were written by a newer version of the app and were reset.'],
    }
  }

  if (fromVersion <= 1) {
    return {
      data: upgradeSettingsV1toV2(raw, base),
      fromVersion,
      toVersion: SCHEMA_VERSION,
      migrated: fromVersion !== SCHEMA_VERSION,
      warnings: fromVersion === 0 ? ['Stored settings were unreadable and were reset.'] : [],
    }
  }

  const roster = stringArrayOr(raw.defaultPermanentRoster, base.defaultPermanentRoster, 40)
  const branches = stringArrayOr(raw.recentBranchNames, base.recentBranchNames, MAX_RECENT_BRANCH_NAMES)
  return {
    data: {
      ...base,
      organization: stringOr(raw.organization, base.organization),
      department: stringOr(raw.department, base.department),
      program: stringOr(raw.program, base.program),
      weeklyOffDays: numberArrayOr(raw.weeklyOffDays, base.weeklyOffDays),
      defaultPermanentRoster: roster.length > 0 ? roster : [...DEFAULT_PERMANENT_ROSTER],
      recentTemporaryNames: stringArrayOr(
        raw.recentTemporaryNames,
        base.recentTemporaryNames,
        MAX_RECENT_TEMPORARY_NAMES,
      ),
      recentBranchNames: branches.length > 0 ? branches : [...DEFAULT_BRANCHES],
    },
    fromVersion,
    toVersion: SCHEMA_VERSION,
    migrated: false,
    warnings: [],
  }
}

function upgradeHolidaysV1toV2(raw: Record<string, unknown>): HolidayState {
  const holidays: Record<string, Holiday> = {}
  for (const [date, value] of Object.entries(raw)) {
    if (!isValidIso(date)) continue
    if (typeof value === 'string') holidays[date] = { source: 'imported', nameEn: value }
    else if (isRecord(value)) {
      holidays[date] = {
        source: value.source === 'manual' ? 'manual' : 'imported',
        nameEn: stringOr(value.nameEn ?? value.name, 'Holiday'),
        ...(typeof value.nameBn === 'string' && value.nameBn ? { nameBn: value.nameBn } : {}),
        ...(value.tentative === true ? { tentative: true } : {}),
      }
    }
  }
  const workingOverrides: Record<string, true> = {}
  const legacyOverrides = raw.workingDayOverrides
  if (isRecord(legacyOverrides)) {
    for (const [date, value] of Object.entries(legacyOverrides)) {
      if (isValidIso(date) && value !== false) workingOverrides[date] = true
    }
  }
  return { schemaVersion: 2, holidays, workingOverrides }
}

export function migrateHolidays(raw: unknown): MigrationResult<HolidayState> {
  const base = emptyHolidayState()
  if (!isRecord(raw)) {
    return { data: base, fromVersion: 0, toVersion: SCHEMA_VERSION, migrated: false, warnings: [] }
  }

  const fromVersion = versionOf(raw)
  if (fromVersion > SCHEMA_VERSION) {
    return {
      data: base,
      fromVersion,
      toVersion: SCHEMA_VERSION,
      migrated: false,
      warnings: ['Stored holidays were written by a newer version of the app and were reset.'],
    }
  }

  if (fromVersion <= 1) {
    return {
      data: upgradeHolidaysV1toV2(raw),
      fromVersion,
      toVersion: SCHEMA_VERSION,
      migrated: fromVersion !== SCHEMA_VERSION,
      warnings: fromVersion === 0 && Object.keys(raw).length > 0 ? ['Stored holidays were unreadable and were reset.'] : [],
    }
  }

  const holidays: Record<string, Holiday> = {}
  const rawHolidays = raw.holidays
  if (isRecord(rawHolidays)) {
    for (const [date, value] of Object.entries(rawHolidays)) {
      if (!isValidIso(date) || !isRecord(value)) continue
      holidays[date] = {
        source: value.source === 'manual' ? 'manual' : 'imported',
        nameEn: stringOr(value.nameEn, 'Holiday'),
        ...(typeof value.nameBn === 'string' && value.nameBn ? { nameBn: value.nameBn } : {}),
        ...(value.tentative === true ? { tentative: true } : {}),
      }
    }
  }
  const workingOverrides: Record<string, true> = {}
  if (isRecord(raw.workingOverrides)) {
    for (const [date, value] of Object.entries(raw.workingOverrides)) {
      if (isValidIso(date) && value !== false) workingOverrides[date] = true
    }
  }
  return {
    data: { schemaVersion: SCHEMA_VERSION, holidays, workingOverrides },
    fromVersion,
    toVersion: SCHEMA_VERSION,
    migrated: false,
    warnings: [],
  }
}

function upgradeMonthV1toV2(raw: Record<string, unknown>, year: number, month: number): MonthSchedule {
  const fallback = emptyFallbackMonth(year, month)
  const officers: Officer[] = []
  const assignments: Record<string, Record<WindowKey, Assignment>> = {}

  const legacyOfficers = Array.isArray(raw.officers) ? raw.officers : []
  legacyOfficers.forEach((entry, index) => {
    if (!isRecord(entry)) return
    const name = stringOr(entry.name, '').trim()
    if (!name) return
    const kind = entry.kind === 'temporary' ? 'temporary' : 'permanent'
    const id = stringOr(entry.id, '') || `migrated-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    officers.push({ id, name, kind, crossedOut: entry.crossedOut === true })
    assignments[id] = {
      one: {
        branch: stringOr(entry.b1, ''),
        customRanges: readRanges(entry.d1),
        ...(typeof entry.note1 === 'string' && entry.note1 ? { note: entry.note1 } : {}),
      },
      two: {
        branch: stringOr(entry.b2, ''),
        customRanges: readRanges(entry.d2),
        ...(typeof entry.note2 === 'string' && entry.note2 ? { note: entry.note2 } : {}),
      },
    }
  })

  const windowOne = rangeOr(raw.w1, fallback.windows.one)
  const windowTwo = rangeOr(raw.w2, fallback.windows.two)
  const bounds = monthBounds(toMonthKey(year, month))
  const monthStart = bounds?.min ?? ''
  const monthEnd = bounds?.max ?? ''

  return {
    ...fallback,
    schemaVersion: 2,
    windows: {
      one: clampIntoMonth(windowOne, monthStart, monthEnd),
      two: clampIntoMonth(windowTwo, monthStart, monthEnd),
    },
    activities: stringArrayOr(raw.activities, [...DEFAULT_ACTIVITIES], 24),
    officers,
    assignments,
  }
}

function clampIntoMonth(range: DateRange, monthStart: string, monthEnd: string): DateRange {
  const start = compareIso(range.start, monthStart) < 0 ? monthStart : range.start
  const end = compareIso(range.end, monthEnd) > 0 ? monthEnd : range.end
  return compareIso(start, end) <= 0 ? { start, end } : { start, end: start }
}

function emptyFallbackMonth(year: number, month: number): MonthSchedule {
  return {
    schemaVersion: SCHEMA_VERSION,
    year,
    month,
    windows: {
      one: { start: toMonthKey(year, month) + '-01', end: toMonthKey(year, month) + '-01' },
      two: { start: toMonthKey(year, month) + '-01', end: toMonthKey(year, month) + '-01' },
    },
    activities: [...DEFAULT_ACTIVITIES],
    officers: [],
    assignments: {},
  }
}

export function migrateMonth(
  raw: unknown,
  monthKey: string,
): MigrationResult<MonthSchedule> {
  const parts = parseMonthKey(monthKey) ?? { year: 1970, month: 1 }
  if (!isRecord(raw)) {
    return {
      data: emptyFallbackMonth(parts.year, parts.month),
      fromVersion: 0,
      toVersion: SCHEMA_VERSION,
      migrated: false,
      warnings: [],
    }
  }

  const fromVersion = versionOf(raw)
  if (fromVersion > SCHEMA_VERSION) {
    return {
      data: emptyFallbackMonth(parts.year, parts.month),
      fromVersion,
      toVersion: SCHEMA_VERSION,
      migrated: false,
      warnings: [`Schedule for ${monthKey} was written by a newer version and was reset.`],
    }
  }

  if (fromVersion <= 1) {
    return {
      data: upgradeMonthV1toV2(raw, parts.year, parts.month),
      fromVersion,
      toVersion: SCHEMA_VERSION,
      migrated: fromVersion !== SCHEMA_VERSION,
      warnings: fromVersion === 0 ? [`Schedule for ${monthKey} was unreadable and was reset.`] : [],
    }
  }

  const rawWindows = isRecord(raw.windows) ? raw.windows : {}
  const windowOne = rangeOr(rawWindows.one, { start: '', end: '' })
  const windowTwo = rangeOr(rawWindows.two, { start: '', end: '' })

  const fallbackStart = `${toMonthKey(parts.year, parts.month)}-01`
  const windows: Record<WindowKey, DateRange> = {
    one: isValidIso(windowOne.start) && isValidIso(windowOne.end) ? windowOne : { start: fallbackStart, end: fallbackStart },
    two: isValidIso(windowTwo.start) && isValidIso(windowTwo.end) ? windowTwo : { start: fallbackStart, end: fallbackStart },
  }

  const officers: Officer[] = []
  const assignments: Record<string, Record<WindowKey, Assignment>> = {}
  const rawOfficers = Array.isArray(raw.officers) ? raw.officers : []
  rawOfficers.forEach((entry, index) => {
    if (!isRecord(entry)) return
    const name = stringOr(entry.name, '').trim()
    if (!name) return
    const id = stringOr(entry.id, '') || `migrated-${index}`
    officers.push({
      id,
      name,
      kind: entry.kind === 'temporary' ? 'temporary' : 'permanent',
      crossedOut: entry.crossedOut === true,
    })
    assignments[id] = { one: emptyAssignment(), two: emptyAssignment() }
  })

  const rawAssignments = isRecord(raw.assignments) ? raw.assignments : {}
  for (const officer of officers) {
    const rawEntry = rawAssignments[officer.id]
    if (!isRecord(rawEntry)) continue
    for (const windowKey of ['one', 'two'] as const) {
      const rawWindow = rawEntry[windowKey]
      if (!isRecord(rawWindow)) continue
      const slot = assignments[officer.id]
      if (!slot) continue
      slot[windowKey] = {
        branch: stringOr(rawWindow.branch, ''),
        customRanges: readRanges(rawWindow.customRanges),
        ...(typeof rawWindow.note === 'string' && rawWindow.note ? { note: rawWindow.note } : {}),
      }
    }
  }

  return {
    data: {
      schemaVersion: SCHEMA_VERSION,
      year: typeof raw.year === 'number' ? raw.year : parts.year,
      month: typeof raw.month === 'number' ? raw.month : parts.month,
      windows,
      activities: stringArrayOr(raw.activities, [...DEFAULT_ACTIVITIES], 24),
      officers,
      assignments,
    },
    fromVersion,
    toVersion: SCHEMA_VERSION,
    migrated: false,
    warnings: [],
  }
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  backupVersion: number
  exportedAt: string
  settings: AppSettings
  holidays: HolidayState
  months: Record<string, MonthSchedule>
}

export function buildBackup(input: {
  settings: AppSettings
  holidays: HolidayState
  months: Record<string, MonthSchedule>
}): BackupFile {
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: input.settings,
    holidays: input.holidays,
    months: input.months,
  }
}

export interface RestoreResult {
  settings: AppSettings
  holidays: HolidayState
  months: Record<string, MonthSchedule>
  warnings: string[]
}

export function parseBackup(text: string): RestoreResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`The backup file is not valid JSON: ${message}`)
  }

  if (!isRecord(parsed)) {
    throw new Error('The backup file must contain a JSON object.')
  }
  if (parsed.format !== BACKUP_FORMAT) {
    throw new Error('That file is not a Monitoring Schedule Planner backup.')
  }

  const settings = migrateSettings(parsed.settings)
  const holidays = migrateHolidays(parsed.holidays)
  const months: Record<string, MonthSchedule> = {}
  const warnings = [...settings.warnings, ...holidays.warnings]

  if (isRecord(parsed.months)) {
    for (const [monthKey, rawMonth] of Object.entries(parsed.months)) {
      if (!parseMonthKey(monthKey)) {
        warnings.push(`Skipped "${monthKey}" because it is not a valid month key.`)
        continue
      }
      const result = migrateMonth(rawMonth, monthKey)
      warnings.push(...result.warnings)
      months[monthKey] = result.data
    }
  }

  return { settings: settings.data, holidays: holidays.data, months, warnings }
}

export function holidayContextFrom(state: HolidayState, weeklyOffDays: number[]): HolidayContext {
  return {
    holidays: state.holidays,
    workingOverrides: state.workingOverrides,
    weeklyOffDays,
  }
}

export function monthStorageKey(monthKey: string): string {
  return `${STORAGE_KEYS.monthPrefix}${monthKey}`
}

export function monthKeyFromStorageKey(key: string): string | null {
  const match = MONTH_KEY_PATTERN.exec(key)
  const candidate = match?.[1]
  if (candidate === undefined) return null
  return parseMonthKey(candidate) === null ? null : candidate
}

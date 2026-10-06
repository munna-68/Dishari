import type { DateRange } from './date-format'
import { toMonthKey } from './date'

export const SCHEMA_VERSION = 2

export interface AppSettings {
  schemaVersion: number
  organization: string
  department: string
  program: string
  /** 0 = Sunday ... 6 = Saturday. Defaults to Friday and Saturday. */
  weeklyOffDays: number[]
  defaultPermanentRoster: string[]
  recentTemporaryNames: string[]
  recentBranchNames: string[]
  mergeIdenticalTemporaryCells: boolean
  splitRangesAroundHolidays: boolean
  crossMarkTemporaryNames: boolean
}

export type OfficerKind = 'permanent' | 'temporary'

export interface Officer {
  id: string
  name: string
  kind: OfficerKind
  crossedOut: boolean
}

export interface Assignment {
  branch: string
  customRanges: DateRange[]
  note?: string
}

export type WindowKey = 'one' | 'two'

export interface MonthSchedule {
  schemaVersion: number
  year: number
  month: number
  windows: Record<WindowKey, DateRange>
  activities: string[]
  officers: Officer[]
  assignments: Record<string, Record<WindowKey, Assignment>>
}

export const MAX_RECENT_TEMPORARY_NAMES = 20
export const MAX_RECENT_BRANCH_NAMES = 150

export const DEFAULT_PERMANENT_ROSTER = [
  'Moyen Uddin',
  'Md. Nuruzzaman',
  'Kartick Bhowmik',
  'Jamir Uddin',
  'Sanchya Sarker',
  'Mamunur Rashid',
  'Rashedul Islam',
  'Anwarul Islam',
  'Md. Laku Mia',
]

export const DEFAULT_ACTIVITIES = [
  'Verify loans and savings at the group level.',
  'Assess staff productivity.',
  'Observe the status of savings collections and refunds.',
  'Verify the loan disbursement and documentation process.',
  'Observe follow-up activities on the loan ceiling and overdue loans.',
  'Observe follow-up activities on write-offs and rescheduled loans.',
  'Verify the 100% auditing and reconciliation process.',
  'Conduct a study to observe the write-off loan situation.',
]

export function defaultSettings(): AppSettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    organization: 'RDRS Bangladesh',
    department: 'MEL Department',
    program: 'Microfinance Program',
    weeklyOffDays: [5, 6],
    defaultPermanentRoster: [...DEFAULT_PERMANENT_ROSTER],
    recentTemporaryNames: [],
    recentBranchNames: [],
    mergeIdenticalTemporaryCells: false,
    splitRangesAroundHolidays: false,
    crossMarkTemporaryNames: false,
  }
}

export function emptyAssignment(): Assignment {
  return { branch: '', customRanges: [] }
}

export function emptyMonthSchedule(year: number, month: number): MonthSchedule {
  const firstOfMonth = `${toMonthKey(year, month)}-01`
  return {
    schemaVersion: SCHEMA_VERSION,
    year,
    month,
    windows: {
      one: { start: firstOfMonth, end: firstOfMonth },
      two: { start: firstOfMonth, end: firstOfMonth },
    },
    activities: [...DEFAULT_ACTIVITIES],
    officers: [],
    assignments: {},
  }
}

/**
 * Newest-first, case-insensitive de-duplicated memory lists with a hard cap.
 * Blank and duplicate entries are dropped rather than stored.
 */
export function pushRecent(list: string[], value: string, limit: number): string[] {
  const trimmed = value.trim()
  if (!trimmed) return list
  const lowered = trimmed.toLowerCase()
  const without = list.filter((entry) => entry.trim().toLowerCase() !== lowered)
  return [trimmed, ...without].slice(0, limit)
}

export function rememberTemporaryName(settings: AppSettings, name: string): AppSettings {
  return {
    ...settings,
    recentTemporaryNames: pushRecent(
      settings.recentTemporaryNames,
      name,
      MAX_RECENT_TEMPORARY_NAMES,
    ),
  }
}

export function rememberBranchName(settings: AppSettings, branch: string): AppSettings {
  return {
    ...settings,
    recentBranchNames: pushRecent(settings.recentBranchNames, branch, MAX_RECENT_BRANCH_NAMES),
  }
}

export function dismissRecent(list: string[], value: string): string[] {
  const lowered = value.trim().toLowerCase()
  return list.filter((entry) => entry.trim().toLowerCase() !== lowered)
}

let idCounter = 0

export function createId(prefix = 'id'): string {
  idCounter += 1
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${random}`
}

export function createPermanentOfficers(names: string[]): Officer[] {
  return names
    .map((name) => name.trim())
    .filter((name) => name !== '')
    .map((name, index) => ({ id: `p-${index}-${slug(name)}`, name, kind: 'permanent' as const, crossedOut: false }))
}

export function createPermanentOfficer(name: string): Officer {
  return { id: createId('p'), name: name.trim(), kind: 'permanent', crossedOut: false }
}

export function createTemporaryOfficer(name: string): Officer {
  return { id: createId('t'), name: name.trim(), kind: 'temporary', crossedOut: false }
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
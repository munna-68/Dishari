import {
  addDays,
  compareIso,
  dayOfWeek,
  eachIsoDay,
  isValidIso,
  pad2,
  parseMonthKey,
  todayIso,
} from './date'

export type HolidaySource = 'imported' | 'manual'

export interface Holiday {
  source: HolidaySource
  nameEn: string
  nameBn?: string
  tentative?: boolean
}

export interface HolidayState {
  schemaVersion: number
  holidays: Record<string, Holiday>
  workingOverrides: Record<string, true>
}

export type DayStatus =
  | { kind: 'working' }
  | { kind: 'weekly-off' }
  | { kind: 'holiday'; holiday: Holiday }
  | { kind: 'override' }

/** Read-only view over the global holiday store used by the pure functions. */
export interface HolidayContext {
  holidays: Record<string, Holiday>
  workingOverrides: Record<string, true>
  weeklyOffDays: number[]
}

export function emptyHolidayContext(weeklyOffDays: number[] = [5, 6]): HolidayContext {
  return { holidays: {}, workingOverrides: {}, weeklyOffDays }
}

export function isWeeklyOff(iso: string, weeklyOffDays: number[]): boolean {
  if (!isValidIso(iso)) return false
  return weeklyOffDays.includes(dayOfWeek(iso))
}

/**
 * An override beats a holiday, a holiday beats a weekly off day. That ordering
 * is what makes the click cycle in `toggleDayStatus` reversible.
 */
export function resolveDayStatus(iso: string, context: HolidayContext): DayStatus {
  if (context.workingOverrides[iso]) return { kind: 'override' }
  const holiday = context.holidays[iso]
  if (holiday) return { kind: 'holiday', holiday }
  if (isWeeklyOff(iso, context.weeklyOffDays)) return { kind: 'weekly-off' }
  return { kind: 'working' }
}

export function isWorkingDay(iso: string, context: HolidayContext): boolean {
  const status = resolveDayStatus(iso, context)
  return status.kind === 'working' || status.kind === 'override'
}

export function holidayLabel(status: DayStatus): string | null {
  if (status.kind !== 'holiday') return null
  const { nameEn, nameBn, tentative } = status.holiday
  const english = nameEn.trim() || 'Manual holiday'
  const bengali = nameBn?.trim()
  return bengali ? `${english} (${bengali})` : tentative ? `${english} (tentative)` : english
}

export function holidayName(iso: string, context: HolidayContext): string | null {
  return holidayLabel(resolveDayStatus(iso, context))
}

export interface DayToggleResult {
  context: HolidayContext
  previous: DayStatus
  status: DayStatus
  message: string
}

/**
 * One click on a calendar cell walks the full cycle described in the brief:
 * working day -> manual holiday -> working day, weekly off -> working-day
 * override -> weekly off.
 */
export function toggleDayStatus(
  iso: string,
  context: HolidayContext,
  manualName = 'Manual holiday',
): DayToggleResult {
  const previous = resolveDayStatus(iso, context)
  const holidays = { ...context.holidays }
  const workingOverrides = { ...context.workingOverrides }

  let status: DayStatus
  let message: string

  if (previous.kind === 'working' || previous.kind === 'override') {
    // A plain working day becomes a manual holiday. An override is a working
    // day, but the brief asks for override -> weekly off, so branch on it.
    if (previous.kind === 'override') {
      delete workingOverrides[iso]
      status = { kind: 'weekly-off' }
      message = `${iso} is back to a weekly off day.`
    } else {
      holidays[iso] = { source: 'manual', nameEn: manualName }
      status = { kind: 'holiday', holiday: holidays[iso] as Holiday }
      message = `${iso} marked as a manual holiday.`
    }
  } else if (previous.kind === 'holiday') {
    delete holidays[iso]
    status = resolveDayStatus(iso, { holidays, workingOverrides, weeklyOffDays: context.weeklyOffDays })
    message = `${iso} is a working day again.`
  } else {
    workingOverrides[iso] = true
    status = { kind: 'override' }
    message = `${iso} set as a working-day override.`
  }

  return {
    context: { holidays, workingOverrides, weeklyOffDays: context.weeklyOffDays },
    previous,
    status,
    message,
  }
}

export function setWorkingOverride(
  context: HolidayContext,
  iso: string,
  working: boolean,
): HolidayContext {
  const workingOverrides = { ...context.workingOverrides }
  if (working) workingOverrides[iso] = true
  else delete workingOverrides[iso]
  return { ...context, workingOverrides }
}

export function setHoliday(
  context: HolidayContext,
  iso: string,
  holiday: Holiday | null,
): HolidayContext {
  const holidays = { ...context.holidays }
  if (holiday) holidays[iso] = holiday
  else delete holidays[iso]
  return { ...context, holidays }
}

export function countWorkingDays(
  start: string,
  end: string,
  context: HolidayContext,
): number {
  if (!isValidIso(start) || !isValidIso(end)) return 0
  if (compareIso(start, end) > 0) return 0
  let count = 0
  for (const iso of eachIsoDay(start, end)) {
    if (isWorkingDay(iso, context)) count += 1
  }
  return count
}

/**
 * Nearest working day to `iso`. Weekly off days and holidays are skipped.
 * `bound` keeps the search from wandering off into another month.
 */
export function snapToWorkingDay(
  iso: string,
  context: HolidayContext,
  direction: 'forward' | 'backward' | 'nearest',
  bound?: { min?: string; max?: string },
): string | null {
  if (!isValidIso(iso)) return null
  if (isWorkingDay(iso, context)) return iso

  const search = (start: string, step: number): string | null => {
    let cursor = start
    for (let stepCount = 0; stepCount < 400; stepCount += 1) {
      if (bound?.min && compareIso(cursor, bound.min) < 0) return null
      if (bound?.max && compareIso(cursor, bound.max) > 0) return null
      if (isWorkingDay(cursor, context)) return cursor
      cursor = addDays(cursor, step)
    }
    return null
  }

  if (direction === 'forward') return search(iso, 1)
  if (direction === 'backward') return search(iso, -1)

  // Nearest expands outward one day at a time, preferring the later date on a tie.
  for (let distance = 1; distance <= 400; distance += 1) {
    const later = addDays(iso, distance)
    if ((!bound?.max || compareIso(later, bound.max) <= 0) && isWorkingDay(later, context)) return later
    const earlier = addDays(iso, -distance)
    if ((!bound?.min || compareIso(earlier, bound.min) >= 0) && isWorkingDay(earlier, context)) return earlier
  }
  return null
}

export function workingDaysInMonth(year: number, month: number, context: HolidayContext): string[] {
  const parts = parseMonthKey(`${year}-${pad2(month)}`)
  if (!parts) return []
  const days: string[] = []
  let cursor = new Date(year, month - 1, 1)
  while (cursor.getMonth() === month - 1) {
    const iso = `${year}-${pad2(month)}-${pad2(cursor.getDate())}`
    if (isWorkingDay(iso, context)) days.push(iso)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  }
  return days
}

export interface WindowDefault {
  start: string
  end: string
  workingDays: number
}

/**
 * Defaults for a fresh month: the first ten working days, then the next nine.
 * Short months simply run out of working days rather than spilling over.
 */
export function defaultWindows(
  year: number,
  month: number,
  context: HolidayContext,
): { one: WindowDefault; two: WindowDefault } {
  const working = workingDaysInMonth(year, month, context)
  const monthEnd = working[working.length - 1] ?? `${year}-${pad2(month)}-01`

  const first = working.slice(0, 10)
  const second = working.slice(10, 19)

  const oneStart = first[0] ?? monthEnd
  const oneEnd = first[first.length - 1] ?? monthEnd

  if (second.length === 0) {
    return {
      one: { start: oneStart, end: oneEnd, workingDays: first.length },
      two: { start: oneEnd, end: oneEnd, workingDays: 0 },
    }
  }

  const twoStart = second[0] ?? oneEnd
  const twoEnd = second[second.length - 1] ?? twoStart

  return {
    one: { start: oneStart, end: oneEnd, workingDays: first.length },
    two: { start: twoStart, end: twoEnd, workingDays: second.length },
  }
}

export interface SplitRange {
  start: string
  end: string
}

/**
 * Splits an inclusive date range at every non-working day so the printed text
 * can show "05-09 & 12-16 July" instead of one continuous run.
 */
export function splitRangeAroundNonWorkingDays(
  range: SplitRange,
  context: HolidayContext,
): SplitRange[] {
  const result: SplitRange[] = []
  let currentStart: string | null = null

  for (const iso of eachIsoDay(range.start, range.end)) {
    if (isWorkingDay(iso, context)) {
      if (!currentStart) currentStart = iso
      continue
    }
    if (currentStart) {
      result.push({ start: currentStart, end: addDays(iso, -1) })
      currentStart = null
    }
  }
  if (currentStart) result.push({ start: currentStart, end: range.end })

  return result
}

export function isToday(iso: string): boolean {
  return iso === todayIso()
}


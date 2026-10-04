import {
  addDays as addDaysDate,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parse,
  startOfMonth,
} from 'date-fns'

/**
 * Every date in this app is a plain calendar date (year, month, day) stored as
 * an ISO `YYYY-MM-DD` string. Dates are never round-tripped through UTC or a
 * time zone, so there is no way for an off-by-one error to appear.
 */

export const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export type IsoDate = string

/** Month names as printed on the schedule sheets. September is abbreviated. */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Printed abbreviation used on the real sheets. */
export const MONTH_NAMES_PRINTED = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'Sept',
  'October',
  'November',
  'December',
] as const as ReadonlyArray<string>

/** Sunday-first short labels for the calendar header. */
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** Local calendar date -> ISO string. Never uses toISOString(). */
export function toIso(date: Date): IsoDate {
  return `${format(date, 'yyyy')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** ISO string -> local midnight Date. Returns null when the input is not a real date. */
export function fromIso(iso: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(iso)
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  if (month < 1 || month > 12) return null
  const date = new Date(year, month - 1, day)
  // Rejects overflow such as 2026-02-31 rolling over into March.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function isValidIso(value: unknown): value is IsoDate {
  return typeof value === 'string' && fromIso(value) !== null
}

export function todayIso(): IsoDate {
  return toIso(new Date())
}

export function addDays(iso: IsoDate, amount: number): IsoDate {
  const date = fromIso(iso)
  if (!date) throw new Error(`addDays received an invalid date: ${iso}`)
  return toIso(addDaysDate(date, amount))
}

export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isWithin(iso: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return compareIso(iso, start) >= 0 && compareIso(iso, end) <= 0
}

export function daysBetween(start: IsoDate, end: IsoDate): number {
  const from = fromIso(start)
  const to = fromIso(end)
  if (!from || !to) throw new Error(`daysBetween received invalid dates: ${start}..${end}`)
  return differenceInCalendarDays(to, from)
}

/** Inclusive list of ISO dates. Returns `[]` when the range is inverted. */
export function eachIsoDay(start: IsoDate, end: IsoDate): IsoDate[] {
  if (compareIso(start, end) > 0) return []
  const from = fromIso(start)
  const to = fromIso(end)
  if (!from || !to) return []
  return eachDayOfInterval({ start: from, end: to }).map(toIso)
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(iso: IsoDate): number {
  const date = fromIso(iso)
  if (!date) throw new Error(`dayOfWeek received an invalid date: ${iso}`)
  return getDay(date)
}

export function daysInMonth(year: number, month: number): number {
  return endOfMonth(new Date(year, month - 1, 1)).getDate()
}

export function startOfMonthIso(year: number, month: number): IsoDate {
  return toIso(startOfMonth(new Date(year, month - 1, 1)))
}

export function endOfMonthIso(year: number, month: number): IsoDate {
  return toIso(endOfMonth(new Date(year, month - 1, 1)))
}

/** Every day of the month as ISO strings, in order. */
export function monthIsoDays(year: number, month: number): IsoDate[] {
  return eachIsoDay(startOfMonthIso(year, month), endOfMonthIso(year, month))
}

/**
 * The 6x7 grid the large calendar renders: weeks start on Sunday and the grid
 * always holds 42 cells so the layout never jumps between months.
 */
export function monthGridIsoDays(year: number, month: number): IsoDate[] {
  const first = startOfMonthIso(year, month)
  const leading = dayOfWeek(first)
  const gridStart = addDays(first, -leading)
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

export interface MonthKeyParts {
  year: number
  month: number
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`
}

export function parseMonthKey(key: string): MonthKeyParts | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function shiftMonthKey(key: string, delta: number): string {
  const parts = parseMonthKey(key)
  if (!parts) throw new Error(`shiftMonthKey received an invalid month key: ${key}`)
  const zeroBased = parts.month - 1 + delta
  const year = parts.year + Math.floor(zeroBased / 12)
  const month = ((zeroBased % 12) + 12) % 12
  return toMonthKey(year, month + 1)
}

export function monthKeyOf(iso: IsoDate): string {
  return iso.slice(0, 7)
}

/** Inclusive first and last day of a month, as ISO dates. */
export function monthBounds(key: string): { min: string; max: string } | null {
  const parts = parseMonthKey(key)
  if (!parts) return null
  return { min: startOfMonthIso(parts.year, parts.month), max: endOfMonthIso(parts.year, parts.month) }
}

export function monthLabel(key: string): string {
  const parts = parseMonthKey(key)
  if (!parts) return key
  const name = MONTH_NAMES[parts.month - 1] ?? ''
  return `${name} ${parts.year}`
}

export function longDateLabel(iso: IsoDate): string {
  const date = fromIso(iso)
  if (!date) return iso
  return format(date, 'd MMMM yyyy')
}

export function shortDateLabel(iso: IsoDate): string {
  const date = fromIso(iso)
  if (!date) return iso
  return format(date, 'd MMM')
}

/** Value for `<input type="date">`. */
export function dateInputValue(iso: IsoDate): string {
  return iso
}

const INPUT_FORMATS = ['d MMMM yyyy', 'd MMM yyyy', 'dd-MM-yyyy', 'd-M-yyyy', 'd/MM/yyyy', 'MMMM d, yyyy']

/**
 * Best-effort parsing for humans pasting a date. Accepts ISO first, then a few
 * common printed forms. Returns null when nothing sensible can be read.
 */
export function parseLooseDate(input: string): IsoDate | null {
  const value = input.trim()
  if (!value) return null
  if (ISO_DATE_PATTERN.test(value)) return isValidIso(value) ? value : null

  const slashed = value.replace(/\//g, '-')
  const isoish = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(slashed)
  if (isoish) {
    const [, y, m, d] = isoish
    const candidate = `${y}-${pad2(Number(m))}-${pad2(Number(d))}`
    return isValidIso(candidate) ? candidate : null
  }

  for (const pattern of INPUT_FORMATS) {
    const parsed = parse(value, pattern, new Date(2000, 0, 1))
    if (!Number.isNaN(parsed.getTime())) {
      const candidate = toIso(parsed)
      if (isValidIso(candidate)) return candidate
    }
  }
  return null
}

export function clampIso(iso: IsoDate, min: IsoDate, max: IsoDate): IsoDate {
  if (compareIso(iso, min) < 0) return min
  if (compareIso(iso, max) > 0) return max
  return iso
}
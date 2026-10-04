import { compareIso, fromIso, pad2 } from './date'
import { MONTH_NAMES_PRINTED } from './date'
import type { HolidayContext } from './working-days'
import { splitRangeAroundNonWorkingDays } from './working-days'

export interface DateRange {
  start: string
  end: string
}

function parts(iso: string): { day: string; month: number; year: number } {
  const date = fromIso(iso)
  if (!date) throw new Error(`Invalid ISO date reached the formatter: ${iso}`)
  return {
    day: pad2(date.getDate()),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  }
}

function monthName(month: number): string {
  return MONTH_NAMES_PRINTED[month - 1] ?? ''
}

/** "04 October" for a single day. */
export function formatSingleDay(iso: string): string {
  const { day, month } = parts(iso)
  return `${day} ${monthName(month)}`
}

/** "04-13 October" for an inclusive range inside one month. */
export function formatSimpleRange(range: DateRange): string {
  const start = parts(range.start)
  const end = parts(range.end)
  if (range.start === range.end) return `${start.day} ${monthName(start.month)}`
  if (start.month === end.month && start.year === end.year) {
    return `${start.day}-${end.day} ${monthName(start.month)}`
  }
  return `${formatSingleDay(range.start)} - ${formatSingleDay(range.end)}`
}

/**
 * The printed schedule format: several ranges joined with " & " and the month
 * name written once at the end, e.g. "05-16 & 26-28 July".
 *
 * Ranges that cross a month boundary keep their own month name on each part,
 * which is the only readable way to print them.
 */
export function formatRanges(ranges: DateRange[]): string {
  const usable = ranges.filter(
    (range) =>
      Boolean(range.start) &&
      Boolean(range.end) &&
      fromIso(range.start) !== null &&
      fromIso(range.end) !== null &&
      compareIso(range.start, range.end) <= 0,
  )
  if (usable.length === 0) return ''

  const first = parts((usable[0] as DateRange).start)
  // The month is written once at the end only when every range sits in the
  // same month as the first one.
  const singleMonth = usable.every((range) => {
    const start = parts(range.start)
    const end = parts(range.end)
    return start.month === first.month && start.year === first.year && end.month === start.month && end.year === start.year
  })

  if (!singleMonth) return usable.map(formatSimpleRange).join(' & ')

  const last = usable[usable.length - 1] as DateRange
  const label = monthName(parts(last.start).month)
  const chunks = usable.map((range, index) => {
    const start = parts(range.start)
    const end = parts(range.end)
    const isLast = index === usable.length - 1
    if (range.start === range.end) return isLast ? `${start.day} ${label}` : start.day
    const body = `${start.day}-${end.day}`
    return isLast ? `${body} ${label}` : body
  })

  return chunks.join(' & ')
}

/**
 * Range text for an officer cell. When `splitAroundHolidays` is on, every range
 * is broken at holidays and weekly off days first.
 */
export function formatRangeText(
  ranges: DateRange[],
  options: { splitAroundHolidays: boolean; context: HolidayContext },
): string {
  if (!options.splitAroundHolidays) return formatRanges(ranges)

  const expanded: DateRange[] = []
  for (const range of ranges) {
    expanded.push(...splitRangeAroundNonWorkingDays(range, options.context))
  }
  return formatRanges(expanded)
}

export function formatWindowLabel(
  range: DateRange,
  workingDayCount: number,
  workingDaysNoun: (count: number) => string,
): string {
  const start = parts(range.start)
  return `${start.day} to ${pad2(fromIso(range.end)?.getDate() ?? 0)} ${monthName(start.month)}, ${workingDaysNoun(workingDayCount)}`
}

export { monthName as printedMonthName }
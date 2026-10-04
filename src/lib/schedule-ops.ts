import {
  addDays,
  clampIso,
  compareIso,
  dayOfWeek,
  isValidIso,
  monthBounds,
  parseMonthKey,
} from './date'
import type { DateRange } from './date-format'
import type { MonthSchedule, WindowKey } from './schema'
import {
  countWorkingDays,
  defaultWindows,
  isWorkingDay,
  snapToWorkingDay,
  type HolidayContext,
} from './working-days'

export interface SnapOutcome {
  range: DateRange
  changed: boolean
  message: string | null
}

/**
 * Keeps a window inside its own month and on working days. Clamping happens
 * first so a date dragged into another month comes back rather than sticking
 * around outside the schedule.
 */
function clampAndSnap(range: DateRange, key: string, context: HolidayContext): SnapOutcome {
  const bounds = monthBounds(key)
  if (!bounds) return { range, changed: false, message: null }

  const ordered = normaliseRange(range)
  const wantedStart = clampIso(ordered.start, bounds.min, bounds.max)
  const wantedEnd = clampIso(ordered.end, bounds.min, bounds.max)
  const wasClamped = wantedStart !== ordered.start || wantedEnd !== ordered.end

  const start = snapToWorkingDay(wantedStart, context, 'nearest', bounds) ?? wantedStart
  const end = snapToWorkingDay(wantedEnd, context, 'nearest', bounds) ?? wantedEnd
  const result: DateRange = compareIso(start, end) <= 0 ? { start, end } : { start, end: start }

  const changed = result.start !== range.start || result.end !== range.end
  if (!changed) return { range: result, changed, message: null }

  if (wasClamped) return { range: result, changed, message: `The window was kept inside ${key}.` }
  if (range.start !== result.start && range.end !== result.end) {
    return { range: result, changed, message: `The window ends moved to the nearest working days in ${key}.` }
  }
  if (range.start !== result.start) return { range: result, changed, message: 'The window start moved to the nearest working day.' }
  return { range: result, changed, message: 'The window end moved to the nearest working day.' }
}

export interface WindowUpdateResult {
  windows: MonthSchedule['windows']
  message: string | null
}

/** Window two may never begin before window one ends, so it is pushed forward. */
function enforceOrder(
  windows: MonthSchedule['windows'],
  monthKey: string,
  context: HolidayContext,
): { windows: MonthSchedule['windows']; pushed: boolean; truncated: boolean } {
  const one = windows.one
  const two = windows.two
  if (compareIso(two.start, one.end) > 0) return { windows, pushed: false, truncated: false }

  const bounds = monthBounds(monthKey)
  const lastWorkingDay = bounds ? snapToWorkingDay(bounds.max, context, 'backward', bounds) : null
  const length = countWorkingDays(two.start, two.end, context)

  // Start on the first working day strictly after window one ends.
  let start = addDays(one.end, 1)
  let guard = 0
  while (!isWorkingDay(start, context) && guard < 60) {
    start = addDays(start, 1)
    guard += 1
  }

  if (length === 0 || guard >= 60 || (lastWorkingDay !== null && compareIso(start, lastWorkingDay) > 0)) {
    // Nothing usable is left in the month; report an empty second window.
    return { windows: { ...windows, two: { start: one.end, end: one.end } }, pushed: true, truncated: true }
  }

  let end = advanceWorkingDays(start, length, context)

  let truncated = false
  if (lastWorkingDay !== null && compareIso(end, lastWorkingDay) > 0) {
    end = lastWorkingDay
    truncated = true
  }

  return { windows: { ...windows, two: { start, end } }, pushed: true, truncated }
}

export function setWindow(
  schedule: MonthSchedule,
  windowKey: WindowKey,
  next: DateRange,
  monthKey: string,
  context: HolidayContext,
): WindowUpdateResult {
  const messages: string[] = []
  const windows = { ...schedule.windows }

  const snapped = clampAndSnap(next, monthKey, context)
  windows[windowKey] = snapped.range
  if (snapped.message) messages.push(snapped.message)

  const ordered = enforceOrder(windows, monthKey, context)
  if (ordered.pushed) {
    windows.two = ordered.windows.two
    messages.push('Window 2 was pushed so it starts after window 1 ends.')
    if (ordered.truncated) {
      messages.push(
        `Window 2 now runs ${windows.two.start === windows.two.end ? 'with no working days left' : `to ${windows.two.end}`} in ${monthKey}.`,
      )
    }
  }

  return { windows, message: messages.length > 0 ? messages.join(' ') : null }
}

/**
 * Called after a holiday toggle: any window edge that landed on a day which is
 * no longer a working day is moved to the nearest working day, and the window
 * order is re-checked.
 */
export function resnapWindows(
  schedule: MonthSchedule,
  monthKey: string,
  context: HolidayContext,
): WindowUpdateResult {
  const bounds = monthBounds(monthKey) ?? undefined
  let working: MonthSchedule = schedule
  const messages: string[] = []

  for (const windowKey of ['one', 'two'] as const) {
    const range = working.windows[windowKey]
    const start = isWorkingDay(range.start, context)
      ? range.start
      : (snapToWorkingDay(range.start, context, 'backward', bounds) ?? range.start)
    const end = isWorkingDay(range.end, context)
      ? range.end
      : (snapToWorkingDay(range.end, context, 'nearest', bounds) ?? range.end)

    if (start === range.start && end === range.end) continue

    const label = windowKey === 'one' ? 'Window 1' : 'Window 2'
    const movedEdge =
      start !== range.start && end !== range.end
        ? `${label} moved to ${start} to ${end}`
        : start !== range.start
          ? `The ${label.toLowerCase()} start moved to ${start}`
          : `The ${label.toLowerCase()} end moved to ${end}`
    messages.push(`${movedEdge}, the nearest working day.`)

    const result = setWindow(working, windowKey, { start, end }, monthKey, context)
    working = { ...working, windows: result.windows }
    if (result.message) messages.push(result.message)
  }

  return { windows: working.windows, message: messages.length > 0 ? messages.join(' ') : null }
}

export function normaliseRange(range: DateRange): DateRange {
  return compareIso(range.start, range.end) <= 0 ? range : { start: range.end, end: range.start }
}

/**
 * Dragging the middle of a band shifts the whole window and keeps its
 * working-day length, so a shift never changes how many visits it contains.
 */
export function shiftWindow(
  schedule: MonthSchedule,
  windowKey: WindowKey,
  deltaWorkingDays: number,
  monthKey: string,
  context: HolidayContext,
): WindowUpdateResult {
  if (deltaWorkingDays === 0) return { windows: schedule.windows, message: null }

  const range = schedule.windows[windowKey]
  const bounds = monthBounds(monthKey)
  const start = shiftByWorkingDays(range.start, deltaWorkingDays, context)
  const end = shiftByWorkingDays(range.end, deltaWorkingDays, context)
  if (!start || !end) {
    return { windows: schedule.windows, message: 'The window cannot move any further inside this month.' }
  }
  const limited =
    bounds && start && end
      ? {
          start: compareIso(start, bounds.min) < 0 ? bounds.min : start,
          end: compareIso(end, bounds.max) > 0 ? bounds.max : end,
        }
      : { start, end }
  return setWindow(schedule, windowKey, limited, monthKey, context)
}

/**
 * Moves a date by whole working days, which is what a calendar drag handle does:
 * the end lands on a working day and never in the middle of a weekly off.
 */
export function shiftDateByWorkingDays(
  iso: string,
  delta: number,
  context: HolidayContext,
): string | null {
  return shiftByWorkingDays(iso, delta, context)
}

/**
 * Walks forward from `iso` by `count` working days, skipping weekly off days and
 * holidays. A small guard stops it running forever when nothing is a working day.
 */
function advanceWorkingDays(iso: string, count: number, context: HolidayContext): string {
  if (count <= 1) return iso
  let cursor = iso
  let moved = 0
  let guard = 0
  while (moved < count - 1 && guard < 1000) {
    // The cursor always moves; only working days count towards the total.
    cursor = addDays(cursor, 1)
    if (isWorkingDay(cursor, context)) moved += 1
    guard += 1
  }
  return cursor
}

/** Moves a date by whole working days in either direction, or null if it runs out. */
function shiftByWorkingDays(iso: string, delta: number, context: HolidayContext): string | null {
  if (delta === 0) return iso
  const step = delta > 0 ? 1 : -1
  let remaining = Math.abs(delta)
  let cursor = iso
  while (remaining > 0) {
    let next = addDays(cursor, step)
    let guard = 0
    while (!isWorkingDay(next, context) && guard < 60) {
      next = addDays(next, step)
      guard += 1
    }
    if (guard >= 60) return null
    cursor = next
    remaining -= 1
  }
  return cursor
}

/**
 * Dragging a handle moves only that end. The end never crosses the opposite
 * end of the same window, so a drag past it just clamps.
 */
export function moveWindowEdge(
  schedule: MonthSchedule,
  windowKey: WindowKey,
  edge: 'start' | 'end',
  targetDate: string,
  monthKey: string,
  context: HolidayContext,
): WindowUpdateResult {
  const range = schedule.windows[windowKey]
  const crossedOver =
    edge === 'start' ? compareIso(targetDate, range.end) > 0 : compareIso(targetDate, range.start) < 0

  const next: DateRange =
    edge === 'start'
      ? { start: crossedOver ? range.end : targetDate, end: range.end }
      : { start: range.start, end: crossedOver ? range.start : targetDate }

  const result = setWindow(schedule, windowKey, next, monthKey, context)
  if (!crossedOver) return result

  const note = `The window ${edge} cannot come ${edge === 'start' ? 'after' : 'before'} the other ${edge === 'start' ? 'end' : 'start'}.`
  return { windows: result.windows, message: result.message ? `${result.message} ${note}` : note }
}

/** Recomputes both windows from the default rule for the month. */
export function resetWindowsToDefault(
  monthKey: string,
  context: HolidayContext,
): MonthSchedule['windows'] {
  const parts = parseMonthKey(monthKey)
  if (!parts) {
    return {
      one: { start: '', end: '' },
      two: { start: '', end: '' },
    }
  }
  const defaults = defaultWindows(parts.year, parts.month, context)
  return {
    one: { start: defaults.one.start, end: defaults.one.end },
    two: { start: defaults.two.start, end: defaults.two.end },
  }
}

export interface ScheduleWarning {
  id: string
  severity: 'warning'
  message: string
}

function normaliseBranch(branch: string): string {
  return branch.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Duplicate branch in the same window, and custom ranges that land on a holiday. */
export function collectScheduleWarnings(
  schedule: MonthSchedule,
  context: HolidayContext,
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = []
  const officers = schedule.officers.filter((officer) => !officer.crossedOut)

  for (const windowKey of ['one', 'two'] as const) {
    // Keyed on the normalised text, but reported using the original spelling.
    const seen = new Map<string, { label: string; names: string[] }>()
    for (const officer of officers) {
      const branch = schedule.assignments[officer.id]?.[windowKey]?.branch.trim() ?? ''
      if (branch === '') continue
      const key = normaliseBranch(branch)
      const entry = seen.get(key) ?? { label: branch, names: [] }
      entry.names.push(officer.name)
      seen.set(key, entry)
    }
    for (const [key, entry] of seen) {
      if (entry.names.length < 2) continue
      warnings.push({
        id: `duplicate-${windowKey}-${key}`,
        severity: 'warning',
        message: `${entry.label} is assigned to ${entry.names.length} officers in window ${
          windowKey === 'one' ? 1 : 2
        }: ${entry.names.join(', ')}.`,
      })
    }
  }

  for (const officer of officers) {
    for (const windowKey of ['one', 'two'] as const) {
      const assignment = schedule.assignments[officer.id]?.[windowKey]
      if (!assignment) continue
      for (const range of assignment.customRanges) {
        for (const edge of ['start', 'end'] as const) {
          const iso = range[edge]
          if (!isWorkingDay(iso, context)) {
            const name = holidayNameOf(iso, context) ?? describeDay(iso)
            warnings.push({
              id: `holiday-edge-${officer.id}-${windowKey}-${range.start}-${range.end}-${edge}`,
              severity: 'warning',
              message: `${officer.name}'s window ${
                windowKey === 'one' ? 1 : 2
              } custom range starts or ends on ${name}.`,
            })
            break
          }
        }
      }
    }
  }

  return warnings
}

function holidayNameOf(iso: string, context: HolidayContext): string | null {
  const holiday = context.holidays[iso]
  if (!holiday) return null
  const name = holiday.nameEn.trim() || 'a holiday'
  return `${name} (${iso})`
}

function describeDay(iso: string): string {
  const index = dayOfWeek(iso)
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = names[index] ?? ''
  return `${dayName} ${iso}, which is not a working day`
}

export interface ExportBlocker {
  id: string
  message: string
}

export function collectExportBlockers(schedule: MonthSchedule): ExportBlocker[] {
  const blockers: ExportBlocker[] = []
  const active = schedule.officers.filter((officer) => !officer.crossedOut)

  if (active.length === 0) {
    blockers.push({
      id: 'no-officers',
      message: 'This month has no officers in the table yet, so the export would be empty.',
    })
  }

  for (const windowKey of ['one', 'two'] as const) {
    const range = schedule.windows[windowKey]
    if (!isValidIso(range.start) || !isValidIso(range.end) || range.start === range.end) {
      blockers.push({
        id: `empty-window-${windowKey}`,
        message: `Window ${windowKey === 'one' ? 1 : 2} contains no working days.`,
      })
    }
  }

  const seen = new Map<string, string>()
  for (const officer of active) {
    for (const windowKey of ['one', 'two'] as const) {
      const branch = schedule.assignments[officer.id]?.[windowKey]?.branch.trim() ?? ''
      if (branch === '') continue
      const id = `${windowKey}::${officer.id}`
      const key = `${windowKey}::${normaliseBranch(branch)}`
      const firstSeen = seen.get(key)
      if (firstSeen && firstSeen !== id) {
        blockers.push({
          id: `dup-${key}-${id}`,
          message: `The same branch text is used by two officers in window ${windowKey === 'one' ? 1 : 2}.`,
        })
      } else if (!firstSeen) {
        seen.set(key, id)
      }
    }
  }

  return blockers
}

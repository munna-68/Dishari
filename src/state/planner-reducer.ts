import { parseMonthKey, shiftMonthKey } from '@/lib/date'
import type { DateRange } from '@/lib/date-format'
import { mergeHoliday, rowsToHolidays, type ParsedHolidayRow } from '@/lib/holidays'
import {
  moveWindowEdge,
  resnapWindows,
  resetWindowsToDefault,
  setWindow as setWindowRange,
  shiftWindow,
} from '@/lib/schedule-ops'
import { applySampleMonth, createCarriedSchedule, SAMPLE_MONTH_KEY } from '@/lib/seed'
import {
  createPermanentOfficers,
  createTemporaryOfficer,
  dismissRecent,
  emptyAssignment,
  rememberBranchName,
  rememberTemporaryName,
  type AppSettings,
  type Assignment,
  type MonthSchedule,
  type Officer,
  type WindowKey,
} from '@/lib/schema'
import { holidayContextFrom } from '@/lib/storage'
import {
  defaultWindows,
  toggleDayStatus,
  type Holiday,
  type HolidayContext,
  type HolidayState,
} from '@/lib/working-days'

export interface PlannerState {
  settings: AppSettings
  holidays: HolidayState
  months: Record<string, MonthSchedule>
}

export type PlannerAction =
  | { type: 'settings/update'; patch: Partial<AppSettings> }
  | { type: 'settings/replace'; settings: AppSettings }
  | { type: 'settings/dismissRecentName'; name: string }
  | { type: 'holidays/toggleDay'; iso: string; monthKey: string }
  | { type: 'holidays/import'; rows: ParsedHolidayRow[] }
  | { type: 'holidays/remove'; iso: string }
  | { type: 'holidays/rename'; iso: string; name: string }
  | { type: 'holidays/clearImportedInMonth'; monthKey: string }
  | { type: 'holidays/replace'; holidays: HolidayState }
  | { type: 'month/startBlank'; monthKey: string }
  | { type: 'month/carryOver'; monthKey: string }
  | { type: 'month/loadSample'; monthKey: string }
  | { type: 'month/setWindow'; monthKey: string; windowKey: WindowKey; range: DateRange }
  | { type: 'month/moveWindowEdge'; monthKey: string; windowKey: WindowKey; edge: 'start' | 'end'; date: string }
  | { type: 'month/shiftWindow'; monthKey: string; windowKey: WindowKey; deltaWorkingDays: number }
  | { type: 'month/resetWindows'; monthKey: string }
  | { type: 'month/setBranch'; monthKey: string; officerId: string; windowKey: WindowKey; branch: string }
  | { type: 'month/setCustomRanges'; monthKey: string; officerId: string; windowKey: WindowKey; ranges: DateRange[] }
  | { type: 'month/setNote'; monthKey: string; officerId: string; windowKey: WindowKey; note: string }
  | { type: 'month/followWindow'; monthKey: string; officerId: string; windowKey: WindowKey }
  | { type: 'month/swapBranches'; monthKey: string; windowKey: WindowKey; fromId: string; toId: string }
  | { type: 'month/addTemporary'; monthKey: string; name: string }
  | { type: 'month/removeOfficer'; monthKey: string; officerId: string }
  | { type: 'month/renameOfficer'; monthKey: string; officerId: string; name: string }
  | { type: 'month/toggleCrossOut'; monthKey: string; officerId: string }
  | { type: 'month/reorderOfficers'; monthKey: string; activeId: string; overId: string }
  | { type: 'month/setRoster'; monthKey: string }
  | { type: 'month/activity/add'; monthKey: string; text: string }
  | { type: 'month/activity/update'; monthKey: string; index: number; text: string }
  | { type: 'month/activity/remove'; monthKey: string; index: number }
  | { type: 'month/activity/move'; monthKey: string; from: number; to: number }
  | { type: 'month/activity/copyPrevious'; monthKey: string; fromMonthKey: string }
  | { type: 'planner/replace'; state: PlannerState }

export interface ActionResult {
  state: PlannerState
  /** A message for the user, when the action changed something visible. */
  message: string | null
}

function contextOf(state: PlannerState): HolidayContext {
  return {
    holidays: state.holidays.holidays,
    workingOverrides: state.holidays.workingOverrides,
    weeklyOffDays: state.settings.weeklyOffDays,
  }
}

function withMonth(
  state: PlannerState,
  monthKey: string,
  update: (schedule: MonthSchedule) => MonthSchedule,
): PlannerState {
  const current = state.months[monthKey]
  if (!current) return state
  return { ...state, months: { ...state.months, [monthKey]: update(current) } }
}

function previousMonthKey(monthKey: string): string {
  return shiftMonthKey(monthKey, -1)
}

/**
 * Builds a month the first time anything touches it, using the default windows
 * for that month and the permanent roster from settings.
 */
export function ensureMonth(state: PlannerState, monthKey: string): MonthSchedule {
  const existing = state.months[monthKey]
  if (existing) return existing
  const parts = parseMonthKey(monthKey)
  const year = parts?.year ?? 1970
  const month = parts?.month ?? 1
  const defaults = defaultWindows(year, month, contextOf(state))
  const officers = createPermanentOfficers(state.settings.defaultPermanentRoster)
  const assignments: Record<string, Record<WindowKey, Assignment>> = {}
  for (const officer of officers) assignments[officer.id] = { one: emptyAssignment(), two: emptyAssignment() }
  return {
    schemaVersion: 2,
    year,
    month,
    windows: {
      one: { start: defaults.one.start, end: defaults.one.end },
      two: { start: defaults.two.start, end: defaults.two.end },
    },
    activities: [],
    officers,
    assignments,
  }
}

function ensureMonthState(state: PlannerState, monthKey: string): PlannerState {
  if (state.months[monthKey]) return state
  return { ...state, months: { ...state.months, [monthKey]: ensureMonth(state, monthKey) } }
}

function updateAssignment(
  schedule: MonthSchedule,
  officerId: string,
  windowKey: WindowKey,
  update: (assignment: Assignment) => Assignment,
): MonthSchedule {
  const existing = schedule.assignments[officerId]
  const current = existing?.[windowKey] ?? emptyAssignment()
  const entry: Record<WindowKey, Assignment> = {
    one: existing?.one ?? emptyAssignment(),
    two: existing?.two ?? emptyAssignment(),
    [windowKey]: update(current),
  }
  return { ...schedule, assignments: { ...schedule.assignments, [officerId]: entry } }
}

function assignmentFor(schedule: MonthSchedule, officerId: string, windowKey: WindowKey): Assignment {
  return schedule.assignments[officerId]?.[windowKey] ?? emptyAssignment()
}

export function reduce(state: PlannerState, action: PlannerAction): ActionResult {
  switch (action.type) {
    case 'settings/update':
      return { state: { ...state, settings: { ...state.settings, ...action.patch } }, message: null }

    case 'settings/replace':
      return { state: { ...state, settings: action.settings }, message: null }

    case 'settings/dismissRecentName':
      return {
        state: {
          ...state,
          settings: { ...state.settings, recentTemporaryNames: dismissRecent(state.settings.recentTemporaryNames, action.name) },
        },
        message: null,
      }

    case 'holidays/toggleDay': {
      const toggled = toggleDayStatus(action.iso, contextOf(state))
      let nextState: PlannerState = { ...state, holidays: { ...state.holidays, ...pick(toggled.context) } }
      const messages = toggled.message === null ? [] : [toggled.message]

      const schedule = nextState.months[action.monthKey]
      if (schedule) {
        const nextContext = holidayContextFrom(nextState.holidays, nextState.settings.weeklyOffDays)
        const resnapped = resnapWindows(schedule, action.monthKey, nextContext)
        if (resnapped.message !== null) messages.push(resnapped.message)
        nextState = {
          ...nextState,
          months: { ...nextState.months, [action.monthKey]: { ...schedule, windows: resnapped.windows } },
        }
      }

      return { state: nextState, message: messages.length > 0 ? messages.join(' ') : null }
    }

    case 'holidays/import': {
      const incoming = rowsToHolidays(action.rows)
      const holidays = { ...state.holidays.holidays }
      let imported = 0
      let updated = 0
      for (const [iso, holiday] of Object.entries(incoming)) {
        const merged = mergeHoliday(holidays[iso], holiday)
        if (holidays[iso]) updated += 1
        else imported += 1
        holidays[iso] = merged
      }
      const parts = `${imported} added`
      const tail = updated > 0 ? `, ${updated} updated` : ''
      return {
        state: { ...state, holidays: { ...state.holidays, holidays } },
        message: `${parts}${tail}. Manual holidays were left untouched.`,
      }
    }

    case 'holidays/remove': {
      const holidays = { ...state.holidays.holidays }
      const workingOverrides = { ...state.holidays.workingOverrides }
      const existed = delete holidays[action.iso]
      const overrideExisted = delete workingOverrides[action.iso]
      if (!existed && !overrideExisted) return { state, message: null }
      return {
        state: { ...state, holidays: { ...state.holidays, holidays, workingOverrides } },
        message: `${action.iso} was cleared.`,
      }
    }

    case 'holidays/rename': {
      const existing = state.holidays.holidays[action.iso]
      if (!existing) return { state, message: null }
      const holiday: Holiday = { ...existing, nameEn: action.name }
      return {
        state: { ...state, holidays: { ...state.holidays, holidays: { ...state.holidays.holidays, [action.iso]: holiday } } },
        message: null,
      }
    }

    case 'holidays/clearImportedInMonth': {
      const holidays = { ...state.holidays.holidays }
      let removed = 0
      for (const [iso, holiday] of Object.entries(holidays)) {
        if (holiday.source !== 'imported') continue
        if (monthKeyOfIso(iso) !== action.monthKey) continue
        delete holidays[iso]
        removed += 1
      }
      if (removed === 0) return { state, message: 'There were no imported holidays in this month.' }
      return {
        state: { ...state, holidays: { ...state.holidays, holidays } },
        message: `${removed} imported holiday${removed === 1 ? '' : 's'} cleared for this month.`,
      }
    }

    case 'holidays/replace':
      return { state: { ...state, holidays: action.holidays }, message: null }

    case 'planner/replace':
      return { state: action.state, message: null }

    case 'month/startBlank':
      return {
        state: ensureMonthState({ ...state, months: { ...state.months, [action.monthKey]: blankMonth(state, action.monthKey) } }, action.monthKey),
        message: `Started a blank ${monthKeyLabel(action.monthKey)}.`,
      }

    case 'month/carryOver': {
      const fromKey = previousMonthKey(action.monthKey)
      const carried = createCarriedSchedule(
        state.settings,
        state.months[fromKey],
        parseMonthKey(action.monthKey)?.year ?? 1970,
        parseMonthKey(action.monthKey)?.month ?? 1,
        defaultWindowsFor(state, action.monthKey),
      )
      return {
        state: { ...state, months: { ...state.months, [action.monthKey]: carried } },
        message: `Carried the activity list and temporary officers over from ${monthKeyLabel(fromKey)}. Branches and dates were cleared.`,
      }
    }

    case 'month/loadSample': {
      const sample = applySampleMonth(state.settings)
      return {
        state: {
          ...state,
          settings: sample.settings,
          months: { ...state.months, [SAMPLE_MONTH_KEY]: sample.schedule },
        },
        message: 'Loaded the October 2026 sample.',
      }
    }

    case 'month/setWindow': {
      const withMonthState = ensureMonthState(state, action.monthKey)
      const schedule = withMonthState.months[action.monthKey] as MonthSchedule
      const result = setWindowRange(schedule, action.windowKey, action.range, action.monthKey, contextOf(withMonthState))
      return {
        state: withMonth(withMonthState, action.monthKey, (current) => ({ ...current, windows: result.windows })),
        message: result.message,
      }
    }

    case 'month/moveWindowEdge': {
      const withMonthState = ensureMonthState(state, action.monthKey)
      const schedule = withMonthState.months[action.monthKey] as MonthSchedule
      const result = moveWindowEdge(schedule, action.windowKey, action.edge, action.date, action.monthKey, contextOf(withMonthState))
      return {
        state: withMonth(withMonthState, action.monthKey, (current) => ({ ...current, windows: result.windows })),
        message: result.message,
      }
    }

    case 'month/shiftWindow': {
      const withMonthState = ensureMonthState(state, action.monthKey)
      const schedule = withMonthState.months[action.monthKey] as MonthSchedule
      const result = shiftWindow(schedule, action.windowKey, action.deltaWorkingDays, action.monthKey, contextOf(withMonthState))
      return {
        state: withMonth(withMonthState, action.monthKey, (current) => ({ ...current, windows: result.windows })),
        message: result.message,
      }
    }

    case 'month/resetWindows': {
      const withMonthState = ensureMonthState(state, action.monthKey)
      const windows = resetWindowsToDefault(action.monthKey, contextOf(withMonthState))
      return {
        state: withMonth(withMonthState, action.monthKey, (current) => ({ ...current, windows })),
        message: 'Windows reset to the first ten and next nine working days of the month.',
      }
    }

    case 'month/setBranch': {
      const branch = action.branch
      const nextState = {
        ...state,
        settings: branch.trim() === '' ? state.settings : rememberBranchName(state.settings, branch),
      }
      return {
        state: withMonth(ensureMonthState(nextState, action.monthKey), action.monthKey, (schedule) =>
          updateAssignment(schedule, action.officerId, action.windowKey, (assignment) => ({ ...assignment, branch })),
        ),
        message: null,
      }
    }

    case 'month/setCustomRanges':
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) =>
          updateAssignment(schedule, action.officerId, action.windowKey, (assignment) => ({
            ...assignment,
            customRanges: action.ranges.filter((range) => range.start !== '' && range.end !== ''),
          })),
        ),
        message: null,
      }

    case 'month/setNote':
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) =>
          updateAssignment(schedule, action.officerId, action.windowKey, (assignment) => ({
            ...assignment,
            ...(action.note.trim() === '' ? { note: '' } : { note: action.note }),
          })),
        ),
        message: null,
      }

    case 'month/followWindow':
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) =>
          updateAssignment(schedule, action.officerId, action.windowKey, (assignment) => ({ ...assignment, customRanges: [] })),
        ),
        message: 'This cell follows the window again.',
      }

    case 'month/swapBranches':
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) => {
          const from = assignmentFor(schedule, action.fromId, action.windowKey)
          const to = assignmentFor(schedule, action.toId, action.windowKey)
          let next = updateAssignment(schedule, action.fromId, action.windowKey, () => ({ ...from, branch: to.branch }))
          next = updateAssignment(next, action.toId, action.windowKey, () => ({ ...to, branch: from.branch }))
          return next
        }),
        message: 'Branch entries swapped.',
      }

    case 'month/addTemporary': {
      const name = action.name.trim()
      if (name === '') return { state, message: 'Type a name before adding an officer.' }
      const withMonthState = ensureMonthState(state, action.monthKey)
      const schedule = withMonthState.months[action.monthKey] as MonthSchedule
      const clash = schedule.officers.some((officer) => officer.name.trim().toLowerCase() === name.toLowerCase())
      if (clash) return { state, message: `${name} is already in this month's list.` }

      const officer = createTemporaryOfficer(name)
      return {
        state: withMonth(
          {
            ...withMonthState,
            settings: rememberTemporaryName(withMonthState.settings, name),
          },
          action.monthKey,
          (current) => ({
            ...current,
            officers: [...current.officers, officer],
            assignments: { ...current.assignments, [officer.id]: { one: emptyAssignment(), two: emptyAssignment() } },
          }),
        ),
        message: `${name} added as a temporary officer for this month only.`,
      }
    }

    case 'month/removeOfficer': {
      const withMonthState = ensureMonthState(state, action.monthKey)
      const schedule = ensureMonth(withMonthState, action.monthKey)
      const officer = schedule.officers.find((entry) => entry.id === action.officerId)
      if (!officer) return { state, message: null }
      const assignments = { ...schedule.assignments }
      delete assignments[action.officerId]
      return {
        state: withMonth(withMonthState, action.monthKey, (current) => ({
          ...current,
          officers: current.officers.filter((entry) => entry.id !== action.officerId),
          assignments,
        })),
        message: `${officer.name} removed from this month.`,
      }
    }

    case 'month/renameOfficer': {
      const name = action.name.trim()
      const withMonthState = ensureMonthState(state, action.monthKey)
      const schedule = withMonthState.months[action.monthKey] as MonthSchedule
      const target = schedule.officers.find((entry) => entry.id === action.officerId)
      if (!target || name === '') return { state, message: null }
      const clash = schedule.officers.some(
        (entry) => entry.id !== action.officerId && entry.name.trim().toLowerCase() === name.toLowerCase(),
      )
      if (clash) return { state, message: `${name} is already in this month's list.` }
      const isPermanent = target.kind === 'permanent'
      return {
        state: withMonth(
          {
            ...withMonthState,
            settings: isPermanent
              ? {
                  ...withMonthState.settings,
                  defaultPermanentRoster: withMonthState.settings.defaultPermanentRoster.map((entry) =>
                    entry === target.name ? name : entry,
                  ),
                }
              : withMonthState.settings,
          },
          action.monthKey,
          (current) => ({
            ...current,
            officers: current.officers.map((entry) => (entry.id === action.officerId ? { ...entry, name } : entry)),
          }),
        ),
        message: null,
      }
    }

    case 'month/toggleCrossOut': {
      const withMonthState = ensureMonthState(state, action.monthKey)
      const schedule = withMonthState.months[action.monthKey] as MonthSchedule
      const target = schedule.officers.find((entry) => entry.id === action.officerId)
      if (!target) return { state, message: null }
      const crossedOut = !target.crossedOut
      return {
        state: withMonth(withMonthState, action.monthKey, (current) => ({
          ...current,
          officers: current.officers.map((entry) => (entry.id === action.officerId ? { ...entry, crossedOut } : entry)),
        })),
        message: crossedOut
          ? `${target.name} crossed out for this month.`
          : `${target.name} restored.`,
      }
    }

    case 'month/reorderOfficers': {
      const withMonthState = ensureMonthState(state, action.monthKey)
      if (action.activeId === action.overId) return { state, message: null }
      return {
        state: withMonth(withMonthState, action.monthKey, (current) => ({
          ...current,
          officers: reorderWithinKind(current.officers, action.activeId, action.overId),
        })),
        message: null,
      }
    }

    case 'month/setRoster': {
      const names = state.settings.defaultPermanentRoster
      const officers = createPermanentOfficers(names)
      const assignments: Record<string, Record<WindowKey, Assignment>> = {}
      const withMonthState = ensureMonthState(state, action.monthKey)
      const schedule = withMonthState.months[action.monthKey] as MonthSchedule
      for (const officer of officers) {
        assignments[officer.id] = schedule.assignments[officer.id] ?? { one: emptyAssignment(), two: emptyAssignment() }
      }
      return {
        state: withMonth(withMonthState, action.monthKey, (current) => ({
          ...current,
          officers: [...officers, ...current.officers.filter((officer) => officer.kind === 'temporary')],
          assignments,
        })),
        message: `${officers.length} permanent officers set from the roster in Settings.`,
      }
    }

    case 'month/activity/add': {
      const text = action.text.trim()
      if (text === '') return { state, message: 'Type the activity before adding it.' }
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) => ({
          ...schedule,
          activities: [...schedule.activities, text],
        })),
        message: null,
      }
    }

    case 'month/activity/update':
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) => ({
          ...schedule,
          activities: schedule.activities.map((entry, index) => (index === action.index ? action.text : entry)),
        })),
        message: null,
      }

    case 'month/activity/remove':
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) => ({
          ...schedule,
          activities: schedule.activities.filter((_, index) => index !== action.index),
        })),
        message: 'Activity removed.',
      }

    case 'month/activity/move':
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) => ({
          ...schedule,
          activities: moveItem(schedule.activities, action.from, action.to),
        })),
        message: null,
      }

    case 'month/activity/copyPrevious': {
      const fromKey = action.fromMonthKey
      const source = state.months[fromKey]
      if (!source || source.activities.length === 0) {
        return { state, message: `${monthKeyLabel(fromKey)} has no activity list to copy.` }
      }
      return {
        state: withMonth(ensureMonthState(state, action.monthKey), action.monthKey, (schedule) => ({
          ...schedule,
          activities: [...source.activities],
        })),
        message: `Copied ${source.activities.length} activities from ${monthKeyLabel(fromKey)}.`,
      }
    }
  }
}

function pick(context: HolidayContext): Pick<HolidayState, 'holidays' | 'workingOverrides'> {
  return { holidays: context.holidays, workingOverrides: context.workingOverrides }
}

function monthKeyOfIso(iso: string): string {
  return `${iso.slice(0, 4)}-${iso.slice(5, 7)}`
}

function monthKeyLabel(monthKey: string): string {
  const parts = parseMonthKey(monthKey)
  if (!parts) return monthKey
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${names[parts.month - 1] ?? ''} ${parts.year}`
}

function blankMonth(state: PlannerState, monthKey: string): MonthSchedule {
  const parts = parseMonthKey(monthKey)
  const year = parts?.year ?? 1970
  const month = parts?.month ?? 1
  const defaults = defaultWindows(year, month, contextOf(state))
  const officers = createPermanentOfficers(state.settings.defaultPermanentRoster)
  const assignments: Record<string, Record<WindowKey, Assignment>> = {}
  for (const officer of officers) assignments[officer.id] = { one: emptyAssignment(), two: emptyAssignment() }
  return {
    schemaVersion: 2,
    year,
    month,
    windows: {
      one: { start: defaults.one.start, end: defaults.one.end },
      two: { start: defaults.two.start, end: defaults.two.end },
    },
    activities: [],
    officers,
    assignments,
  }
}

function defaultWindowsFor(state: PlannerState, monthKey: string): MonthSchedule['windows'] {
  return resetWindowsToDefault(monthKey, contextOf(state))
}

/** Reorders inside one kind only, so permanent officers never swap with temporaries. */
export function reorderWithinKind(officers: Officer[], activeId: string, overId: string): Officer[] {
  const active = officers.find((officer) => officer.id === activeId)
  const over = officers.find((officer) => officer.id === overId)
  if (!active || !over || active.kind !== over.kind) return officers

  const group = officers.filter((officer) => officer.kind === active.kind)
  const fromIndex = group.findIndex((officer) => officer.id === activeId)
  const toIndex = group.findIndex((officer) => officer.id === overId)
  if (fromIndex < 0 || toIndex < 0) return officers

  const moved = moveItem(group, fromIndex, toIndex)
  let cursor = 0
  return officers.map((officer) => (officer.kind === active.kind ? (moved[cursor++] as Officer) : officer))
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item === undefined) return items
  next.splice(to, 0, item)
  return next
}

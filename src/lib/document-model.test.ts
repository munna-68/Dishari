import { describe, expect, it } from 'vitest'

import { buildDocumentModel, columnWidthsPercent, layoutRows, printableOfficers } from './document-model'
import { createSampleSchedule, SAMPLE_MONTH_KEY } from './seed'
import {
  collectExportBlockers,
  collectScheduleWarnings,
  moveWindowEdge,
  setWindow,
  shiftWindow,
} from './schedule-ops'
import { defaultSettings, type MonthSchedule } from './schema'
import { countWorkingDays, emptyHolidayContext, setHoliday, type HolidayContext } from './working-days'

const context: HolidayContext = emptyHolidayContext([5, 6])

function modelFor(schedule: MonthSchedule, overrides: Partial<ReturnType<typeof defaultSettings>> = {}) {
  return buildDocumentModel({
    settings: { ...defaultSettings(), ...overrides },
    schedule,
    context,
  })
}

describe('the document model that feeds all three renderers', () => {
  const sample = createSampleSchedule()

  it('builds the October 2026 heading and file name', () => {
    const model = modelFor(sample)
    expect(model.title).toBe('RDRS Bangladesh')
    expect(model.subtitle).toBe('MEL Department')
    expect(model.heading).toBe('Monitoring Schedule for October 2026')
    expect(model.programLine).toBe('Microfinance Program')
    expect(model.fileBaseName).toBe('Monitoring_Schedule_October_2026')
  })

  it('has the six reference columns in order', () => {
    const model = modelFor(sample)
    expect(model.columns.map((column) => column.header)).toEqual([
      'Activity/Task',
      'Responsible Staff',
      'Branch',
      'Visit Schedule',
      'Branch',
      'Visit Schedule',
    ])
  })

  it('gives the Activity column about a quarter of the width', () => {
    const widths = columnWidthsPercent(modelFor(sample).columns)
    expect(widths[0]).toBeGreaterThan(24)
    expect(widths[0]).toBeLessThan(26)
    const total = widths.reduce((sum, value) => sum + value, 0)
    expect(total).toBeCloseTo(100, 5)
    // Branch columns are wider than the Visit Schedule columns.
    expect(widths[2]).toBeGreaterThan(widths[3] as number)
    expect(widths[4]).toBeGreaterThan(widths[5] as number)
  })

  it('puts one numbered activity block in a single tall merged cell', () => {
    const model = modelFor(sample)
    const header = model.rows[0]
    const firstBody = model.rows[1]
    expect(header?.cells).toHaveLength(6)
    // Eleven officers: nine permanent plus two temporary.
    expect(model.rows).toHaveLength(12)
    expect(firstBody?.cells[0]?.rowSpan).toBe(11)
    expect(firstBody?.cells[0]?.hangingIndent).toBe(true)
    expect(firstBody?.cells[0]?.text.split('\n')).toHaveLength(8)
    expect(firstBody?.cells[0]?.text.startsWith('1. Verify loans')).toBe(true)
    // Every row keeps six positional cells; the layout marks the covered ones.
    expect(model.rows[2]?.cells).toHaveLength(6)
    expect(model.rows[2]?.cells[1]?.text).toBe('Md. Nuruzzaman')
    const layout = layoutRows(model.rows.slice(1))
    expect(layout[1]?.[0]?.merge).toBe('continue')
    expect(layout[0]?.[0]?.merge).toBe('start')
  })

  it('prints the sample branches and dates exactly as the paper sheets do', () => {
    const rows = modelFor(sample).rows.slice(1)
    expect(rows[0]?.cells.map((cell) => cell.text)).toEqual([
      expect.any(String),
      'Moyen Uddin',
      'Mangalpur, Dinajpur',
      '04-13 October',
      'Hatrampur, Dinajpur',
      '14-27 October',
    ])
    // The one officer with a private range in the first window.
    expect(rows[1]?.cells[3]?.text).toBe('04-15 October')
    expect(rows[1]?.cells[5]?.text).toBe('14-27 October')
    // The temporary officers come last.
    expect(rows[9]?.cells[1]?.text).toBe('Maydul Islam')
    expect(rows[9]?.cells[2]?.text).toBe('Issue-Based Monitoring')
    expect(rows[9]?.cells[5]?.text).toBe('14-27 October')
    expect(rows[10]?.cells[1]?.text).toBe('Iftekharul Islam')
    expect(rows[10]?.cells[4]?.text).toBe('Dinajpur Region')
  })

  it('lists permanent officers before temporary ones', () => {
    const names = modelFor(sample).rows.slice(1).map((row) => row.cells[1]?.text)
    const permanentCount = names.filter((name) => name !== 'Maydul Islam' && name !== 'Iftekharul Islam').length
    expect(permanentCount).toBe(9)
    expect(names.slice(-2)).toEqual(['Maydul Islam', 'Iftekharul Islam'])
  })

  it('leaves out crossed-out officers', () => {
    const schedule = structuredClone(sample)
    const target = schedule.officers[2]
    if (target) target.crossedOut = true
    expect(printableOfficers(schedule)).toHaveLength(10)
    expect(modelFor(schedule).rows).toHaveLength(11)
  })

  it('does not merge temporary branch cells by default', () => {
    const rows = modelFor(sample).rows.slice(1)
    expect(rows[9]?.cells[2]?.rowSpan).toBe(1)
    expect(rows[10]?.cells[2]?.rowSpan).toBe(1)
  })

  it('merges identical adjacent temporary branch cells when the setting is on', () => {
    const rows = modelFor(sample, { mergeIdenticalTemporaryCells: true }).rows.slice(1)
    expect(rows[9]?.cells[2]?.text).toBe('Issue-Based Monitoring')
    expect(rows[9]?.cells[2]?.rowSpan).toBe(2)
    // The window two branches differ, so they stay separate.
    expect(rows[9]?.cells[4]?.rowSpan).toBe(1)
  })

  it('does not merge when the temporary branches differ', () => {
    const schedule = structuredClone(sample)
    const second = schedule.officers[10]
    if (second) {
      const assignment = schedule.assignments[second.id]
      if (assignment) assignment.one = { ...assignment.one, branch: 'Kurigram Region' }
    }
    const rows = modelFor(schedule, { mergeIdenticalTemporaryCells: true }).rows.slice(1)
    expect(rows[9]?.cells[2]?.rowSpan).toBe(1)
  })

  it('adds a cross mark beside temporary names only when the setting is on', () => {
    expect(modelFor(sample).rows[11]?.cells[1]?.text).toBe('Iftekharul Islam')
    const crossed = modelFor(sample, { crossMarkTemporaryNames: true }).rows
    expect(crossed[11]?.cells[1]?.text).toBe('× Iftekharul Islam')
    expect(crossed[1]?.cells[1]?.text).toBe('Moyen Uddin')
  })

  it('splits the printed date text when the setting is on', () => {
    const schedule = structuredClone(sample)
    schedule.windows.one = { start: '2026-10-04', end: '2026-10-13' }
    const holiContext: HolidayContext = setHoliday(context, '2026-10-08', {
      source: 'imported',
      nameEn: 'Holi',
    })
    const model = buildDocumentModel({
      settings: { ...defaultSettings(), splitRangesAroundHolidays: true },
      schedule,
      context: holiContext,
    })
    // 8 October is the holiday and 9-10 October are the weekly off days.
    expect(model.rows[1]?.cells[3]?.text).toBe('04-07 & 11-13 October')
  })

  it('says so plainly when the month has no officers', () => {
    const empty: MonthSchedule = { ...structuredClone(sample), officers: [], assignments: {} }
    const model = modelFor(empty)
    expect(model.emptyMessage).toBe('No officers are listed for this month yet.')
    expect(model.rows).toHaveLength(2)
    expect(model.rows[1]?.cells[0]?.colSpan).toBe(6)
  })

  it('warns about branches that are missing', () => {
    const schedule = structuredClone(sample)
    const target = schedule.officers[0]
    if (target) {
      const assignment = schedule.assignments[target.id]
      if (assignment) assignment.two = { ...assignment.two, branch: '' }
    }
    expect(modelFor(schedule).exportWarnings.join(' ')).toContain('Moyen Uddin has no branch set for window 2')
  })
})

describe('warnings that never block the user', () => {
  const sample = createSampleSchedule()

  it('flags the same branch assigned to two officers in one window', () => {
    const schedule = structuredClone(sample)
    const first = schedule.officers[0]
    const second = schedule.officers[1]
    if (first && second && schedule.assignments[first.id] && schedule.assignments[second.id]) {
      schedule.assignments[second.id]!.one = {
        ...schedule.assignments[second.id]!.one,
        branch: 'mangalpur, dinajpur',
      }
    }
    const warnings = collectScheduleWarnings(schedule, context)
    expect(warnings.some((warning) => warning.message.includes('Mangalpur, Dinajpur'))).toBe(true)
    expect(warnings.every((warning) => warning.severity === 'warning')).toBe(true)
  })

  it('does not flag the same branch in different windows', () => {
    const schedule = structuredClone(sample)
    const first = schedule.officers[0]
    const second = schedule.officers[1]
    if (first && second && schedule.assignments[first.id] && schedule.assignments[second.id]) {
      schedule.assignments[second.id]!.two = {
        ...schedule.assignments[second.id]!.two,
        branch: 'Mangalpur, Dinajpur',
      }
    }
    const warnings = collectScheduleWarnings(schedule, context)
    // Moyen's window 1 branch must not be reported because it only repeats in window 2.
    expect(warnings.some((warning) => warning.id === 'duplicate-two-mangalpur, dinajpur')).toBe(false)
  })

  it('does flag the shared branch of two temporary officers in the sample', () => {
    const warnings = collectScheduleWarnings(sample, context)
    expect(warnings.map((warning) => warning.message)).toContain(
      'Issue-Based Monitoring is assigned to 2 officers in window 1: Maydul Islam, Iftekharul Islam.',
    )
  })

  it('flags a custom range that starts on a holiday', () => {
    const schedule = structuredClone(sample)
    const holiContext: HolidayContext = setHoliday(context, '2026-10-04', { source: 'imported', nameEn: 'Holi' })
    const warnings = collectScheduleWarnings(schedule, holiContext)
    expect(warnings.some((warning) => warning.message.includes('custom range starts or ends on'))).toBe(true)
  })

  it('lists export blockers separately from warnings', () => {
    const schedule = structuredClone(sample)
    const first = schedule.officers[0]
    if (first && schedule.assignments[first.id]) {
      schedule.assignments[first.id]!.one = { ...schedule.assignments[first.id]!.one, branch: 'X, Y' }
    }
    const second = schedule.officers[1]
    if (second && schedule.assignments[second.id]) {
      schedule.assignments[second.id]!.one = { ...schedule.assignments[second.id]!.one, branch: 'X, Y' }
    }
    const blockers = collectExportBlockers(schedule)
    expect(blockers.some((blocker) => blocker.id.startsWith('dup-one::x, y'))).toBe(true)
    expect(collectExportBlockers({ ...structuredClone(sample), officers: [], assignments: {} }).map((b) => b.id)).toContain(
      'no-officers',
    )
  })
})

describe('moving a visit window', () => {
  const sample = createSampleSchedule()
  const monthKey = SAMPLE_MONTH_KEY

  it('snaps a handle onto the nearest working day', () => {
    // 10 October 2026 is a Saturday; Sunday the 11th is one step on.
    const result = moveWindowEdge(sample, 'one', 'end', '2026-10-10', monthKey, context)
    expect(result.windows.one.end).toBe('2026-10-11')
    expect(result.message).toContain('nearest working day')
  })

  it('clamps a handle dragged past the other end instead of inverting', () => {
    // Dragging the end of window one back to before its own start.
    const result = moveWindowEdge(sample, 'one', 'end', '2026-10-02', monthKey, context)
    expect(result.windows.one).toEqual({ start: '2026-10-04', end: '2026-10-04' })
    expect(result.message).not.toBeNull()
  })

  it('pushes window two so it never starts before window one ends', () => {
    const result = setWindow(sample, 'one', { start: '2026-10-01', end: '2026-10-20' }, monthKey, context)
    expect(result.windows.one.end).toBe('2026-10-20')
    // 21 October is the first working day after window one ends.
    expect(result.windows.two.start).toBe('2026-10-21')
    expect(result.message).toContain('pushed')
  })

  it('keeps the working-day length when a window is shifted', () => {
    const before = countWorkingDays(sample.windows.one.start, sample.windows.one.end, context)
    expect(before).toBe(8)
    const result = shiftWindow(sample, 'one', 2, monthKey, context)
    expect(countWorkingDays(result.windows.one.start, result.windows.one.end, context)).toBe(before)
    expect(result.windows.one.start).not.toBe(sample.windows.one.start)
  })

  it('orders an inverted range instead of printing it backwards', () => {
    const result = setWindow(sample, 'one', { start: '2026-10-13', end: '2026-10-04' }, monthKey, context)
    expect(result.windows.one.start <= result.windows.one.end).toBe(true)
  })

  it('drags a handle back inside the month', () => {
    const result = moveWindowEdge(sample, 'one', 'end', '2026-11-15', monthKey, context)
    expect(result.windows.one.end.startsWith('2026-10-')).toBe(true)
    expect(result.message).toContain('inside 2026-10')
  })

  it('truncates window two rather than letting it run into the next month', () => {
    // Window one already ends on the last working day of October.
    const result = setWindow(sample, 'one', { start: '2026-10-01', end: '2026-10-29' }, monthKey, context)
    expect(result.windows.two).toEqual({ start: '2026-10-29', end: '2026-10-29' })
    expect(result.message).toContain('no working days left')
  })

  it('stops window two on the last working day of the month', () => {
    const result = setWindow(sample, 'one', { start: '2026-10-01', end: '2026-10-27' }, monthKey, context)
    expect(result.windows.two.start).toBe('2026-10-28')
    // The 30th and 31st are the weekly off days, so the last working day is the 29th.
    expect(result.windows.two.end).toBe('2026-10-29')
    expect(result.message).toContain('pushed')
  })
})

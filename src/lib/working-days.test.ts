import { describe, expect, it } from 'vitest'

import { monthKeyOf, pad2 } from './date'
import {
  countWorkingDays,
  defaultWindows,
  emptyHolidayContext,
  isWorkingDay,
  isWeeklyOff,
  nthWorkingDayOfMonth,
  resolveDayStatus,
  setWorkingOverride,
  snapToWorkingDay,
  splitRangeAroundNonWorkingDays,
  toggleDayStatus,
  workingDaysInMonth,
  type HolidayContext,
} from './working-days'

const base: HolidayContext = emptyHolidayContext([5, 6])

function withHoliday(iso: string, nameEn = 'Eid'): HolidayContext {
  return { ...base, holidays: { [iso]: { source: 'imported' as const, nameEn } } }
}

describe('resolving the status of a calendar cell', () => {
  it('treats Friday and Saturday as weekly off days by default', () => {
    // 2 October 2026 is a Friday, 3 October a Saturday.
    expect(isWeeklyOff('2026-10-02', [5, 6])).toBe(true)
    expect(isWeeklyOff('2026-10-03', [5, 6])).toBe(true)
    expect(isWeeklyOff('2026-10-04', [5, 6])).toBe(false)
    expect(resolveDayStatus('2026-10-02', base).kind).toBe('weekly-off')
  })

  it('honours a different weekly off configuration', () => {
    const sundayOnly = emptyHolidayContext([0])
    expect(resolveDayStatus('2026-10-04', sundayOnly).kind).toBe('weekly-off')
    expect(resolveDayStatus('2026-10-02', sundayOnly).kind).toBe('working')
  })

  it('gives a working-day override priority over the weekly off rule', () => {
    const context = setWorkingOverride(base, '2026-10-02', true)
    expect(resolveDayStatus('2026-10-02', context).kind).toBe('override')
    expect(isWorkingDay('2026-10-02', context)).toBe(true)
  })

  it('gives a holiday priority over the weekly off rule', () => {
    const context = withHoliday('2026-10-03')
    expect(resolveDayStatus('2026-10-03', context).kind).toBe('holiday')
  })
})

describe('clicking a date cycles through the four states', () => {
  it('turns a plain working day into a manual holiday and back', () => {
    const first = toggleDayStatus('2026-10-05', base)
    expect(first.status.kind).toBe('holiday')
    expect(first.context.holidays['2026-10-05']?.source).toBe('manual')
    expect(first.message).toContain('manual holiday')

    const second = toggleDayStatus('2026-10-05', first.context)
    expect(second.status.kind).toBe('working')
    expect(second.context.holidays['2026-10-05']).toBeUndefined()
  })

  it('turns a weekly off day into a working-day override and back', () => {
    const first = toggleDayStatus('2026-10-02', base)
    expect(first.status.kind).toBe('override')
    expect(first.context.workingOverrides['2026-10-02']).toBe(true)

    const second = toggleDayStatus('2026-10-02', first.context)
    expect(second.status.kind).toBe('weekly-off')
    expect(second.context.workingOverrides['2026-10-02']).toBeUndefined()
  })

  it('turns an imported holiday back into whatever the day would otherwise be', () => {
    const context = withHoliday('2026-10-03') // a Saturday
    const result = toggleDayStatus('2026-10-03', context)
    expect(result.status.kind).toBe('weekly-off')
    expect(result.context.holidays['2026-10-03']).toBeUndefined()
  })

  it('never mutates the context it was given', () => {
    const snapshot = JSON.stringify(base)
    toggleDayStatus('2026-10-05', base)
    expect(JSON.stringify(base)).toBe(snapshot)
  })
})

describe('counting working days', () => {
  it('excludes the weekly off days', () => {
    // October 2026 opens on a Thursday and has 5 Fridays and 5 Saturdays.
    expect(countWorkingDays('2026-10-01', '2026-10-31', base)).toBe(21)
  })

  it('excludes holidays on top of the weekly off days', () => {
    const context = withHoliday('2026-10-12', 'Holi') // a Monday
    expect(countWorkingDays('2026-10-01', '2026-10-31', base)).toBe(21)
    expect(countWorkingDays('2026-10-01', '2026-10-31', context)).toBe(20)
  })

  it('counts an override back in', () => {
    const context = setWorkingOverride(base, '2026-10-02', true)
    expect(countWorkingDays('2026-10-01', '2026-10-31', context)).toBe(22)
  })

  it('counts a single day as one working day', () => {
    expect(countWorkingDays('2026-10-05', '2026-10-05', base)).toBe(1)
    expect(countWorkingDays('2026-10-03', '2026-10-03', base)).toBe(0)
  })

  it('counts a February in a leap year correctly', () => {
    expect(countWorkingDays('2028-02-01', '2028-02-29', base)).toBe(21)
    expect(countWorkingDays('2026-02-01', '2026-02-28', base)).toBe(20)
  })

  it('returns zero for inverted or invalid ranges', () => {
    expect(countWorkingDays('2026-10-13', '2026-10-04', base)).toBe(0)
    expect(countWorkingDays('nonsense', '2026-10-04', base)).toBe(0)
  })
})

describe('snapping to a working day', () => {
  it('returns a working day unchanged', () => {
    expect(snapToWorkingDay('2026-10-05', base, 'forward')).toBe('2026-10-05')
  })

  it('skips a weekly off day forward', () => {
    expect(snapToWorkingDay('2026-10-02', base, 'forward')).toBe('2026-10-04')
  })

  it('skips a weekly off day backward', () => {
    expect(snapToWorkingDay('2026-10-03', base, 'backward')).toBe('2026-10-01')
  })

  it('skips holidays in both directions', () => {
    const context = withHoliday('2026-10-12', 'Holi')
    expect(snapToWorkingDay('2026-10-12', context, 'forward')).toBe('2026-10-13')
    expect(snapToWorkingDay('2026-10-12', context, 'backward')).toBe('2026-10-11')
  })

  it('picks the genuinely closest side when snapping to nearest', () => {
    // 2 October is a Friday: Thursday is one step back, Monday is two steps on.
    expect(snapToWorkingDay('2026-10-02', base, 'nearest')).toBe('2026-10-01')
    // 3 October is a Saturday: Monday is one step on, Thursday is two steps back.
    expect(snapToWorkingDay('2026-10-03', base, 'nearest')).toBe('2026-10-04')
  })

  it('prefers the later date when both sides are equally close', () => {
    const context = withHoliday('2026-10-13', 'Holi') // a Tuesday
    expect(snapToWorkingDay('2026-10-13', context, 'nearest')).toBe('2026-10-14')
  })

  it('steps over a run of consecutive days off', () => {
    const context: HolidayContext = {
      holidays: {
        '2026-10-05': { source: 'imported', nameEn: 'A' },
        '2026-10-06': { source: 'imported', nameEn: 'B' },
      },
      workingOverrides: {},
      weeklyOffDays: [5, 6],
    }
    expect(snapToWorkingDay('2026-10-05', context, 'forward')).toBe('2026-10-07')
  })

  it('gives up rather than leaving the bound', () => {
    // 31 October 2026 is a Saturday and 1 October is already a working day.
    expect(snapToWorkingDay('2026-10-31', base, 'forward', { max: '2026-10-31' })).toBeNull()
    expect(snapToWorkingDay('2026-10-02', base, 'backward', { min: '2026-10-02' })).toBeNull()
    expect(snapToWorkingDay('2026-10-02', base, 'backward', { min: '2026-10-01' })).toBe('2026-10-01')
  })

  it('returns null for an invalid date', () => {
    expect(snapToWorkingDay('2026-02-31', base, 'nearest')).toBeNull()
  })
})

describe('working days within a month', () => {
  it('lists the working days in order', () => {
    const days = workingDaysInMonth(2026, 10, base)
    expect(days[0]).toBe('2026-10-01')
    expect(days[1]).toBe('2026-10-04')
    expect(days).toHaveLength(21)
  })

  it('finds the nth working day', () => {
    expect(nthWorkingDayOfMonth(2026, 10, 1, base)).toBe('2026-10-01')
    expect(nthWorkingDayOfMonth(2026, 10, 2, base)).toBe('2026-10-04')
    expect(nthWorkingDayOfMonth(2026, 10, 10, base)).toBe('2026-10-14')
    expect(nthWorkingDayOfMonth(2026, 10, 99, base)).toBeNull()
  })

  it('returns nothing for an impossible month', () => {
    expect(workingDaysInMonth(2026, 13, base)).toEqual([])
  })
})

describe('default windows for a new month', () => {
  it('takes the first ten working days then the next nine', () => {
    const defaults = defaultWindows(2026, 10, base)
    expect(defaults.one.start).toBe('2026-10-01')
    expect(defaults.one.end).toBe('2026-10-14')
    expect(defaults.one.workingDays).toBe(10)
    expect(defaults.two.start).toBe('2026-10-15')
    expect(defaults.two.end).toBe('2026-10-27')
    expect(defaults.two.workingDays).toBe(9)
  })

  it('starts on the first working day when the month opens on an off day', () => {
    // November 2026 opens on a Sunday.
    const defaults = defaultWindows(2026, 11, base)
    expect(defaults.one.start).toBe('2026-11-01')
    expect(defaults.one.end).toBe('2026-11-12')
    expect(defaults.two.start).toBe('2026-11-15')
  })

  it('skips holidays when counting', () => {
    // A holiday on 6 October pushes the end of the first window one day later.
    const context = withHoliday('2026-10-06', 'Holi')
    const defaults = defaultWindows(2026, 10, context)
    expect(defaults.one.workingDays).toBe(10)
    expect(defaults.one.end).toBe('2026-10-15')
    expect(defaults.two.start).toBe('2026-10-18')
  })

  it('works in a leap-year February', () => {
    const defaults = defaultWindows(2028, 2, base)
    expect(defaults.one.workingDays).toBe(10)
    expect(defaults.one.end).toBe('2028-02-14')
    expect(defaults.two.workingDays).toBe(9)
  })

  it('reports a zero-length second window when the month runs out of working days', () => {
    // Only Sundays left as working days: 4, 11, 18 and 25 October.
    const sundayOnly = emptyHolidayContext([1, 2, 3, 4, 5, 6])
    const defaults = defaultWindows(2026, 10, sundayOnly)
    expect(defaults.one.workingDays).toBe(4)
    expect(defaults.two.workingDays).toBe(0)
    expect(defaults.two.start).toBe(defaults.one.end)
  })
})

describe('splitting ranges at non-working days', () => {
  it('leaves an all-working range untouched', () => {
    expect(splitRangeAroundNonWorkingDays({ start: '2026-10-05', end: '2026-10-07' }, base)).toEqual([
      { start: '2026-10-05', end: '2026-10-07' },
    ])
  })

  it('splits at both the weekly off days and a holiday', () => {
    // 5-8 October, then the 9th and 10th are off, 11 October, the 12th is the
    // holiday, then 13-15 October.
    const context = withHoliday('2026-10-12', 'Holi')
    expect(splitRangeAroundNonWorkingDays({ start: '2026-10-05', end: '2026-10-15' }, context)).toEqual([
      { start: '2026-10-05', end: '2026-10-08' },
      { start: '2026-10-11', end: '2026-10-11' },
      { start: '2026-10-13', end: '2026-10-15' },
    ])
  })

  it('splits at a holiday that falls between working days only', () => {
    const noWeekend = emptyHolidayContext([])
    const context = { ...noWeekend, holidays: { '2026-10-12': { source: 'imported' as const, nameEn: 'Holi' } } }
    expect(splitRangeAroundNonWorkingDays({ start: '2026-10-05', end: '2026-10-15' }, context)).toEqual([
      { start: '2026-10-05', end: '2026-10-11' },
      { start: '2026-10-13', end: '2026-10-15' },
    ])
  })

  it('drops leading and trailing non-working days', () => {
    const context = withHoliday('2026-10-12', 'Holi')
    expect(splitRangeAroundNonWorkingDays({ start: '2026-10-12', end: '2026-10-12' }, context)).toEqual([])
    expect(splitRangeAroundNonWorkingDays({ start: '2026-10-02', end: '2026-10-03' }, base)).toEqual([])
  })
})

describe('month keys', () => {
  it('reads the month from an ISO date', () => {
    expect(monthKeyOf('2026-10-04')).toBe('2026-10')
    expect(`${monthKeyOf('2026-10-04')}`).toBe(`2026-${pad2(10)}`)
  })
})
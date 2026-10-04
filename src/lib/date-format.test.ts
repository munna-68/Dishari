import { describe, expect, it } from 'vitest'

import {
  addDays,
  eachIsoDay,
  fromIso,
  isValidIso,
  monthGridIsoDays,
  monthIsoDays,
  parseLooseDate,
  parseMonthKey,
  shiftMonthKey,
  toIso,
  toMonthKey,
} from './date'
import { formatRangeText, formatRanges, formatSingleDay, formatSimpleRange } from './date-format'
import { emptyHolidayContext, type HolidayContext } from './working-days'

const context: HolidayContext = emptyHolidayContext([5, 6])

describe('ISO date helpers', () => {
  it('round-trips a local calendar date without any UTC shift', () => {
    // A date near midnight would roll over if anything went through UTC.
    expect(toIso(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(toIso(new Date(2026, 11, 31))).toBe('2026-12-31')
    expect(toIso(fromIso('2026-10-04') as Date)).toBe('2026-10-04')
  })

  it('rejects impossible dates instead of rolling them over', () => {
    expect(isValidIso('2026-02-30')).toBe(false)
    expect(isValidIso('2026-13-01')).toBe(false)
    expect(isValidIso('2026-00-10')).toBe(false)
    expect(fromIso('2026-10-4')).toBeNull()
    expect(isValidIso('not-a-date')).toBe(false)
  })

  it('accepts leap days only in leap years', () => {
    expect(isValidIso('2028-02-29')).toBe(true)
    expect(isValidIso('2026-02-29')).toBe(false)
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('builds inclusive ranges and returns nothing when inverted', () => {
    expect(eachIsoDay('2026-10-04', '2026-10-06')).toEqual(['2026-10-04', '2026-10-05', '2026-10-06'])
    expect(eachIsoDay('2026-10-06', '2026-10-04')).toEqual([])
  })

  it('covers 28 to 31 day months', () => {
    expect(monthIsoDays(2026, 2)).toHaveLength(28)
    expect(monthIsoDays(2028, 2)).toHaveLength(29)
    expect(monthIsoDays(2026, 4)).toHaveLength(30)
    expect(monthIsoDays(2026, 10)).toHaveLength(31)
  })

  it('builds a Sunday-first 42 cell grid that always contains the month', () => {
    const grid = monthGridIsoDays(2026, 10)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-09-27')
    expect(grid[41]).toBe('2026-11-07')
    // 1 October 2026 is a Thursday, so four leading Sunday cells.
    expect(grid.indexOf('2026-10-01')).toBe(4)

    const february = monthGridIsoDays(2026, 2)
    expect(february).toContain('2026-02-01')
    expect(february).toContain('2026-02-28')
    expect(new Set(february).size).toBe(42)
  })

  it('moves month keys across year boundaries in both directions', () => {
    expect(shiftMonthKey('2026-10', 1)).toBe('2026-11')
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01')
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2026-01', -13)).toBe('2024-12')
    expect(shiftMonthKey('2026-10', 24)).toBe('2028-10')
    expect(toMonthKey(2026, 3)).toBe('2026-03')
    expect(parseMonthKey('2026-03')).toEqual({ year: 2026, month: 3 })
    expect(parseMonthKey('2026-13')).toBeNull()
  })

  it('reads the loose date forms a human might paste', () => {
    expect(parseLooseDate('2026-10-04')).toBe('2026-10-04')
    expect(parseLooseDate('2026/10/04')).toBe('2026-10-04')
    expect(parseLooseDate('4 October 2026')).toBe('2026-10-04')
    expect(parseLooseDate('04-10-2026')).toBe('2026-10-04')
    expect(parseLooseDate('October 4, 2026')).toBe('2026-10-04')
    expect(parseLooseDate('2026-02-31')).toBeNull()
    expect(parseLooseDate('')).toBeNull()
    expect(parseLooseDate('sometime soon')).toBeNull()
  })
})

describe('printed date text', () => {
  it('prints a single day as "05 July"', () => {
    expect(formatSingleDay('2026-07-05')).toBe('05 July')
    expect(formatRanges([{ start: '2026-07-05', end: '2026-07-05' }])).toBe('05 July')
  })

  it('prints a range as "04-13 October"', () => {
    expect(formatSimpleRange({ start: '2026-10-04', end: '2026-10-13' })).toBe('04-13 October')
    expect(formatRanges([{ start: '2026-10-04', end: '2026-10-13' }])).toBe('04-13 October')
  })

  it('prints September as "Sept", as the paper sheets do', () => {
    expect(formatSimpleRange({ start: '2026-09-01', end: '2026-09-10' })).toBe('01-10 Sept')
    expect(formatRanges([{ start: '2026-09-02', end: '2026-09-05' }, { start: '2026-09-18', end: '2026-09-19' }])).toBe(
      '02-05 & 18-19 Sept',
    )
  })

  it('joins several ranges with " & " and writes the month once at the end', () => {
    expect(
      formatRanges([
        { start: '2026-07-05', end: '2026-07-16' },
        { start: '2026-07-26', end: '2026-07-28' },
      ]),
    ).toBe('05-16 & 26-28 July')
  })

  it('prints each month name when ranges span a month boundary', () => {
    expect(
      formatRanges([
        { start: '2026-10-28', end: '2026-10-31' },
        { start: '2026-11-02', end: '2026-11-04' },
      ]),
    ).toBe('28-31 October & 02-04 November')
  })

  it('keeps a mixed list of ranges and single days readable', () => {
    expect(
      formatRanges([
        { start: '2026-07-05', end: '2026-07-07' },
        { start: '2026-07-19', end: '2026-07-19' },
        { start: '2026-07-26', end: '2026-07-28' },
      ]),
    ).toBe('05-07 & 19 & 26-28 July')
  })

  it('drops incomplete or inverted ranges instead of printing nonsense', () => {
    expect(formatRanges([])).toBe('')
    expect(formatRanges([{ start: '2026-10-13', end: '2026-10-04' }])).toBe('')
    expect(formatRanges([{ start: '', end: '' }])).toBe('')
    expect(formatRanges([{ start: 'oops', end: 'nope' }])).toBe('')
  })
})

describe('splitting printed ranges around holidays', () => {
  const withHoliday: HolidayContext = {
    holidays: { '2026-07-12': { source: 'imported', nameEn: 'Holiday' } },
    workingOverrides: {},
    weeklyOffDays: [5, 6],
  }

  it('leaves the text as one continuous range by default', () => {
    expect(
      formatRangeText([{ start: '2026-07-05', end: '2026-07-16' }], {
        splitAroundHolidays: false,
        context: withHoliday,
      }),
    ).toBe('05-16 July')
  })

  it('splits the text when the setting is on', () => {
    // 5-9 July is Mon-Thu; 10-11 July are the weekly off; 12 July is the holiday.
    expect(
      formatRangeText([{ start: '2026-07-05', end: '2026-07-16' }], {
        splitAroundHolidays: true,
        context: withHoliday,
      }),
    ).toBe('05-09 & 13-16 July')
  })

  it('also splits at weekly off days', () => {
    expect(
      formatRangeText([{ start: '2026-07-09', end: '2026-07-13' }], {
        splitAroundHolidays: true,
        context,
      }),
    ).toBe('09 & 12-13 July')
  })
})
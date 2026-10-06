import { describe, expect, it } from 'vitest'
import { applyDefaultMonth, createDefaultSchedule } from './seed'
import { defaultSettings } from './schema'
import { reduce, type PlannerState } from '@/state/planner-reducer'
import { emptyHolidayState } from './storage'

describe('createDefaultSchedule & applyDefaultMonth', () => {
  it('creates default schedule with 9 permanent and 2 temporary officers and activities for October 2026', () => {
    const schedule = createDefaultSchedule(2026, 10)
    expect(schedule.year).toBe(2026)
    expect(schedule.month).toBe(10)
    expect(schedule.officers.filter((o) => o.kind === 'permanent')).toHaveLength(9)
    expect(schedule.officers.filter((o) => o.kind === 'temporary')).toHaveLength(2)
    expect(schedule.activities.length).toBeGreaterThan(0)
    expect(schedule.assignments).toBeDefined()

    // Temporary officers should include Maydul Islam and Iftekharul Islam
    const tempNames = schedule.officers.filter((o) => o.kind === 'temporary').map((o) => o.name)
    expect(tempNames).toContain('Maydul Islam')
    expect(tempNames).toContain('Iftekharul Islam')
  })

  it('creates default schedule for arbitrary month like October 2027', () => {
    const schedule = createDefaultSchedule(2027, 10)
    expect(schedule.year).toBe(2027)
    expect(schedule.month).toBe(10)
    expect(schedule.officers.filter((o) => o.kind === 'permanent')).toHaveLength(9)
    expect(schedule.officers.filter((o) => o.kind === 'temporary')).toHaveLength(2)
    expect(schedule.activities.length).toBeGreaterThan(0)

    // Check branch assignments are populated
    const assignedOfficers = Object.keys(schedule.assignments)
    expect(assignedOfficers.length).toBe(11)
  })

  it('applyDefaultMonth updates settings with temporary names and recent branches', () => {
    const settings = defaultSettings()
    const result = applyDefaultMonth(settings, 2027, 10)

    expect(result.monthKey).toBe('2027-10')
    expect(result.settings.recentTemporaryNames).toContain('Maydul Islam')
    expect(result.settings.recentTemporaryNames).toContain('Iftekharul Islam')
    expect(result.settings.recentBranchNames.length).toBeGreaterThan(0)
  })

  it('reducer handles month/loadDefault properly', () => {
    const initialState: PlannerState = {
      settings: defaultSettings(),
      holidays: emptyHolidayState(),
      months: {},
    }

    const { state, message } = reduce(initialState, { type: 'month/loadDefault', monthKey: '2027-10' })

    expect(message).toBe('Loaded default data for October 2027.')
    const month = state.months['2027-10']
    expect(month).toBeDefined()
    expect(month!.officers).toHaveLength(11)
    expect(month!.activities.length).toBeGreaterThan(0)
    expect(state.settings.recentTemporaryNames).toContain('Maydul Islam')
  })

  it('reducer blankMonth initializes with default activities and 9 permanent officers', () => {
    const initialState: PlannerState = {
      settings: defaultSettings(),
      holidays: emptyHolidayState(),
      months: {},
    }

    const { state, message } = reduce(initialState, { type: 'month/startBlank', monthKey: '2027-10' })

    expect(message).toBe('Started a blank October 2027.')
    const month = state.months['2027-10']
    expect(month).toBeDefined()
    expect(month!.officers).toHaveLength(9)
    expect(month!.officers.every((o) => o.kind === 'permanent')).toBe(true)
    expect(month!.activities.length).toBeGreaterThan(0)
  })
})

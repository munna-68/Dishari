import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlannerPersistence } from './use-planner-persistence'
import {
  BACKUP_FORMAT,
  STORAGE_KEYS,
  buildBackup,
  migrateHolidays,
  migrateMonth,
  migrateSettings,
  monthKeyFromStorageKey,
  monthStorageKey,
  parseBackup,
} from '@/lib/storage'
import { createStorageAdapter, type StorageAdapter } from '@/lib/storage-adapter'
import { SCHEMA_VERSION, defaultSettings } from '@/lib/schema'

function seededAdapter(entries: Record<string, unknown>): StorageAdapter {
  const map = new Map<string, string>(
    Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]),
  )
  const fake = {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => map.clear(),
  } as unknown as Storage
  return createStorageAdapter(fake)
}

describe('settings migration', () => {
  it('returns defaults for missing storage', () => {
    const result = migrateSettings(null)
    expect(result.data).toEqual(defaultSettings())
    expect(result.migrated).toBe(false)
  })

  it('upgrades the version 1 shape to version 2', () => {
    const legacy = {
      schemaVersion: 1,
      org: 'RDRS Bangladesh',
      department: 'MEL Department',
      program: 'Microfinance Program',
      offDays: ['Friday', 'Saturday'],
      permanentRoster: ['Moyen Uddin', 'Jamir Uddin'],
      recentTempNames: ['Maydul Islam', 'Iftekharul Islam'],
      recentBranches: ['Mangalpur, Dinajpur'],
    }
    const result = migrateSettings(legacy)
    expect(result.migrated).toBe(true)
    expect(result.fromVersion).toBe(1)
    expect(result.toVersion).toBe(SCHEMA_VERSION)
    expect(result.data.organization).toBe('RDRS Bangladesh')
    expect(result.data.weeklyOffDays).toEqual([5, 6])
    expect(result.data.defaultPermanentRoster).toEqual(['Moyen Uddin', 'Jamir Uddin'])
    expect(result.data.recentTemporaryNames).toEqual(['Maydul Islam', 'Iftekharul Islam'])
    expect(result.data.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('maps day names to weekday numbers in any order', () => {
    const result = migrateSettings({ schemaVersion: 1, offDays: ['Sunday', 'Wednesday', 'Friday'] })
    expect(result.data.weeklyOffDays).toEqual([0, 3, 5])
  })

  it('keeps a version 2 record untouched', () => {
    const current = { ...defaultSettings(), recentBranchNames: ['A, B'] }
    const result = migrateSettings(current)
    expect(result.migrated).toBe(false)
    expect(result.data).toEqual(current)
  })

  it('falls back to defaults for a garbage payload', () => {
    const result = migrateSettings('not an object at all')
    expect(result.data).toEqual(defaultSettings())
  })

  it('refuses to downgrade a record written by a newer version', () => {
    const result = migrateSettings({ schemaVersion: 99, organization: 'Something else' })
    expect(result.data).toEqual(defaultSettings())
    expect(result.warnings[0]).toContain('newer version')
  })

  it('repairs partial version 2 records field by field', () => {
    const result = migrateSettings({ schemaVersion: 2, organization: 'Only this', weeklyOffDays: 'nonsense' })
    expect(result.data.organization).toBe('Only this')
    expect(result.data.weeklyOffDays).toEqual([5, 6])
    expect(result.data.department).toBe('MEL Department')
  })

  it('caps the recent lists at their limits', () => {
    const branches = Array.from({ length: 300 }, (_, index) => `Branch ${index}`)
    const names = Array.from({ length: 40 }, (_, index) => `Officer ${index}`)
    const result = migrateSettings({ schemaVersion: 2, recentBranchNames: branches, recentTemporaryNames: names })
    expect(result.data.recentBranchNames).toHaveLength(150)
    expect(result.data.recentTemporaryNames).toHaveLength(20)
  })
})

describe('holiday migration', () => {
  it('upgrades a version 1 date-to-name map', () => {
    const legacy = {
      schemaVersion: 1,
      '2026-02-15': 'Martyrs Day',
      '2026-03-21': { nameEn: 'Eid-ul-Fitr', nameBn: 'ঈদুল ফিতর', tentative: true },
      'not-a-date': 'Ignore me',
    }
    const result = migrateHolidays(legacy)
    expect(result.migrated).toBe(true)
    expect(result.data.holidays['2026-02-15']).toEqual({ source: 'imported', nameEn: 'Martyrs Day' })
    expect(result.data.holidays['2026-03-21']).toEqual({
      source: 'imported',
      nameEn: 'Eid-ul-Fitr',
      nameBn: 'ঈদুল ফিতর',
      tentative: true,
    })
    expect(result.data.holidays['not-a-date']).toBeUndefined()
  })

  it('carries working-day overrides across the upgrade', () => {
    const result = migrateHolidays({
      schemaVersion: 1,
      workingDayOverrides: { '2026-10-02': true, '2026-10-03': false, 'bad-date': true },
    })
    expect(result.data.workingOverrides).toEqual({ '2026-10-02': true })
  })

  it('keeps manual holidays manual when upgrading', () => {
    const result = migrateHolidays({ schemaVersion: 1, '2026-10-05': { source: 'manual', nameEn: 'Office closed' } })
    expect(result.data.holidays['2026-10-05']?.source).toBe('manual')
  })

  it('keeps a version 2 record untouched', () => {
    const current = {
      schemaVersion: 2,
      holidays: { '2026-10-05': { source: 'manual' as const, nameEn: 'Office closed' } },
      workingOverrides: {},
    }
    expect(migrateHolidays(current).data).toEqual(current)
  })

  it('drops holidays whose date key is not a real date', () => {
    const result = migrateHolidays({
      schemaVersion: 2,
      holidays: { '2026-02-31': { source: 'imported', nameEn: 'Bad' }, '2026-03-01': { source: 'imported', nameEn: 'Good' } },
      workingOverrides: {},
    })
    expect(Object.keys(result.data.holidays)).toEqual(['2026-03-01'])
  })
})

describe('month migration', () => {
  const monthKey = '2026-10'

  it('upgrades the flat version 1 shape', () => {
    const legacy = {
      schemaVersion: 1,
      year: 2026,
      month: 10,
      w1: ['2026-10-04', '2026-10-13'],
      w2: ['2026-10-14', '2026-10-27'],
      activities: ['Verify loans.'],
      officers: [
        { id: 'p-0', name: 'Moyen Uddin', b1: 'Mangalpur, Dinajpur', b2: 'Hatrampur, Dinajpur', note1: 'Small branch' },
        { id: 't-0', name: 'Maydul Islam', kind: 'temporary', b1: 'Issue-Based Monitoring', d1: [['2026-10-04', '2026-10-15']] },
      ],
    }
    const result = migrateMonth(legacy, monthKey)
    expect(result.migrated).toBe(true)
    expect(result.data.windows.one).toEqual({ start: '2026-10-04', end: '2026-10-13' })
    expect(result.data.windows.two).toEqual({ start: '2026-10-14', end: '2026-10-27' })
    expect(result.data.activities).toEqual(['Verify loans.'])
    expect(result.data.officers).toHaveLength(2)
    expect(result.data.assignments['p-0']?.one).toEqual({
      branch: 'Mangalpur, Dinajpur',
      customRanges: [],
      note: 'Small branch',
    })
    expect(result.data.assignments['t-0']?.two.branch).toBe('')
    expect(result.data.assignments['t-0']?.one.customRanges).toEqual([{ start: '2026-10-04', end: '2026-10-15' }])
  })

  it('keeps the crossed-out flag through the upgrade', () => {
    const result = migrateMonth(
      { schemaVersion: 1, officers: [{ name: 'Jamir Uddin', crossedOut: true }] },
      monthKey,
    )
    expect(result.data.officers[0]?.crossedOut).toBe(true)
  })

  it('keeps a version 2 record untouched', () => {
    const current = migrateMonth(
      {
        schemaVersion: 2,
        year: 2026,
        month: 10,
        windows: { one: { start: '2026-10-04', end: '2026-10-13' }, two: { start: '2026-10-14', end: '2026-10-27' } },
        activities: ['A'],
        officers: [{ id: 'p-0', name: 'A', kind: 'permanent', crossedOut: false }],
        assignments: { 'p-0': { one: { branch: 'B', customRanges: [] }, two: { branch: '', customRanges: [] } } },
      },
      monthKey,
    ).data
    expect(migrateMonth(current, monthKey).data).toEqual(current)
  })

  it('repairs a version 2 record with a broken window', () => {
    const result = migrateMonth(
      { schemaVersion: 2, windows: { one: { start: 'nope', end: '' }, two: { start: '2026-10-14', end: '2026-10-27' } } },
      monthKey,
    )
    expect(result.data.windows.one).toEqual({ start: '2026-10-01', end: '2026-10-01' })
    expect(result.data.windows.two).toEqual({ start: '2026-10-14', end: '2026-10-27' })
  })

  it('returns an empty month for an unreadable record', () => {
    const result = migrateMonth(null, monthKey)
    expect(result.data.officers).toEqual([])
    expect(result.data.year).toBe(2026)
    expect(result.data.month).toBe(10)
  })
})

describe('month storage keys', () => {
  it('round-trips a month key', () => {
    expect(monthStorageKey('2026-10')).toBe('msp:month:2026-10')
    expect(monthKeyFromStorageKey('msp:month:2026-10')).toBe('2026-10')
  })

  it('ignores keys that are not months', () => {
    expect(monthKeyFromStorageKey('msp:settings')).toBeNull()
    expect(monthKeyFromStorageKey('msp:month:not-a-month')).toBeNull()
    expect(monthKeyFromStorageKey('msp:month:2026-13')).toBeNull()
  })
})

describe('backup round trip', () => {
  const months = {
    '2026-10': migrateMonth(
      {
        schemaVersion: 2,
        windows: { one: { start: '2026-10-04', end: '2026-10-13' }, two: { start: '2026-10-14', end: '2026-10-27' } },
        activities: ['One', 'Two'],
        officers: [{ id: 'p-0', name: 'Moyen Uddin', kind: 'permanent', crossedOut: false }],
        assignments: { 'p-0': { one: { branch: 'Mangalpur, Dinajpur', customRanges: [] }, two: { branch: '', customRanges: [] } } },
      },
      '2026-10',
    ).data,
  }

  it('restores settings, holidays and every month', () => {
    const backup = buildBackup({
      settings: { ...defaultSettings(), recentTemporaryNames: ['Maydul Islam'] },
      holidays: { schemaVersion: 2, holidays: { '2026-10-26': { source: 'imported', nameEn: 'Holi' } }, workingOverrides: {} },
      months,
    })
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.settings.recentTemporaryNames).toEqual(['Maydul Islam'])
    expect(restored.holidays.holidays['2026-10-26']?.nameEn).toBe('Holi')
    expect(Object.keys(restored.months)).toEqual(['2026-10'])
    expect(restored.months['2026-10']?.activities).toEqual(['One', 'Two'])
  })

  it('rejects a file that is not a backup', () => {
    expect(() => parseBackup('{"format":"something-else"}')).toThrow('not a Monitoring Schedule Planner backup')
    expect(() => parseBackup('not json at all')).toThrow('not valid JSON')
    expect(() => parseBackup('[]')).toThrow('must contain a JSON object')
  })

  it('carries the format marker so a foreign file is refused', () => {
    const backup = buildBackup({ settings: defaultSettings(), holidays: { schemaVersion: 2, holidays: {}, workingOverrides: {} }, months: {} })
    expect(backup.format).toBe(BACKUP_FORMAT)
  })
})

describe('the persistence hook', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('migrates stored records on the first render', () => {
    const adapter = seededAdapter({
      [STORAGE_KEYS.settings]: { schemaVersion: 1, offDays: ['Friday', 'Saturday'], recentTempNames: ['Maydul Islam'] },
      [STORAGE_KEYS.holidays]: { schemaVersion: 1, '2026-02-15': 'Martyrs Day' },
      'msp:month:2026-10': { schemaVersion: 1, w1: ['2026-10-04', '2026-10-13'], w2: ['2026-10-14', '2026-10-27'], officers: [] },
    })

    const { result } = renderHook(() => usePlannerPersistence(adapter))

    expect(result.current.data.settings.weeklyOffDays).toEqual([5, 6])
    expect(result.current.data.settings.recentTemporaryNames).toEqual(['Maydul Islam'])
    expect(result.current.data.holidays.holidays['2026-02-15']?.nameEn).toBe('Martyrs Day')
    expect(result.current.data.months['2026-10']?.windows.one).toEqual({ start: '2026-10-04', end: '2026-10-13' })
    expect(result.current.isSaved).toBe(true)
    expect(result.current.storageWarning).toBeNull()
  })

  it('warns and resets when a record came from a newer version', () => {
    const adapter = seededAdapter({ [STORAGE_KEYS.settings]: { schemaVersion: 99 } })
    const { result } = renderHook(() => usePlannerPersistence(adapter))
    expect(result.current.warnings.join(' ')).toContain('newer version')
    expect(result.current.data.settings).toEqual(defaultSettings())
  })

  it('debounces writes and then reports everything is saved', async () => {
    const adapter = seededAdapter({})
    const { result } = renderHook(() => usePlannerPersistence(adapter))

    act(() => {
      result.current.save({
        ...result.current.data,
        settings: { ...result.current.data.settings, department: 'MEL' },
      })
    })

    expect(result.current.status).toBe('pending')

    await waitFor(() => {
      expect(result.current.status).toBe('saved')
    })

    const stored = JSON.parse(adapter.read(STORAGE_KEYS.settings) ?? '{}') as { department: string }
    expect(stored.department).toBe('MEL')
    expect(result.current.data.settings.department).toBe('MEL')
  })

  it('writes one key per month and prunes keys for deleted months', async () => {
    const adapter = seededAdapter({ 'msp:month:2025-01': { schemaVersion: 2 } })
    const { result } = renderHook(() => usePlannerPersistence(adapter))

    act(() => {
      result.current.save({ ...result.current.data, months: { '2026-10': emptySample() } })
    })

    await waitFor(() => {
      expect(adapter.read('msp:month:2026-10')).not.toBeNull()
    })
    expect(adapter.read('msp:month:2025-01')).toBeNull()
  })

  it('falls back to memory and warns when storage throws', () => {
    const broken = {
      get length() {
        return 0
      },
      key: () => null,
      getItem: () => null,
      setItem: () => {
        throw new DOMException('nope', 'QuotaExceededError')
      },
      removeItem: () => undefined,
      clear: () => undefined,
    } as unknown as Storage

    const adapter = createStorageAdapter(broken)
    const { result } = renderHook(() => usePlannerPersistence(adapter))

    expect(result.current.isPersistent).toBe(false)
    expect(result.current.storageWarning).toContain('in memory only')

    // The app still works: state updates even though nothing can be written.
    act(() => {
      result.current.save({
        ...result.current.data,
        settings: { ...result.current.data.settings, program: 'Microfinance Program' },
      })
    })
    expect(result.current.data.settings.program).toBe('Microfinance Program')
  })

  it('warns when storage is unavailable to begin with', () => {
    const adapter = createStorageAdapter(null)
    const { result } = renderHook(() => usePlannerPersistence(adapter))
    expect(result.current.storageWarning).toContain('not available')
    expect(result.current.isPersistent).toBe(false)
  })

  it('restores a backup and resets everything on demand', async () => {
    const adapter = seededAdapter({})
    const { result } = renderHook(() => usePlannerPersistence(adapter))

    const backup = JSON.stringify(
      buildBackup({
        settings: { ...defaultSettings(), organization: 'Restored Org' },
        holidays: { schemaVersion: 2, holidays: {}, workingOverrides: {} },
        months: {
          '2026-09': {
            schemaVersion: 2,
            year: 2026,
            month: 9,
            windows: { one: { start: '2026-09-01', end: '2026-09-10' }, two: { start: '2026-09-11', end: '2026-09-24' } },
            activities: ['Restored activity'],
            officers: [],
            assignments: {},
          },
        },
      }),
    )

    expect(() => parseBackup(backup)).not.toThrow()
    expect(() => parseBackup('{"format":"nope"}')).toThrow()

    act(() => {
      result.current.applyBackup(backup)
    })

    expect(result.current.data.settings.organization).toBe('Restored Org')
    expect(Object.keys(result.current.data.months)).toEqual(['2026-09'])

    await waitFor(() => {
      expect(adapter.read('msp:month:2026-09')).not.toBeNull()
    })

    act(() => {
      result.current.resetAll()
    })

    expect(result.current.data.months).toEqual({})
    expect(result.current.data.settings).toEqual(defaultSettings())
  })

  it('refuses to restore a file that is not a backup', () => {
    const adapter = seededAdapter({})
    const { result } = renderHook(() => usePlannerPersistence(adapter))
    let restored: unknown = 'unset'
    act(() => {
      restored = result.current.applyBackup('{"format":"something-else"}')
    })
    expect(restored).toBeNull()
  })
})

function emptySample(): import('@/lib/schema').MonthSchedule {
  return {
    schemaVersion: SCHEMA_VERSION,
    year: 2026,
    month: 10,
    windows: { one: { start: '2026-10-04', end: '2026-10-13' }, two: { start: '2026-10-14', end: '2026-10-27' } },
    activities: [],
    officers: [],
    assignments: {},
  }
}
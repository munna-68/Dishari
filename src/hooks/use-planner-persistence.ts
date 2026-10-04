import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createStorageAdapter, listStoredMonthKeys, writeJson, type StorageAdapter } from '@/lib/storage-adapter'
import {
  STORAGE_KEYS,
  emptyHolidayState,
  migrateHolidays,
  migrateMonth,
  migrateSettings,
  monthStorageKey,
  parseBackup,
  type MetaRecord,
} from '@/lib/storage'
import { SCHEMA_VERSION, defaultSettings, type AppSettings, type MonthSchedule } from '@/lib/schema'
import type { HolidayState } from '@/lib/working-days'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved'

export interface PersistedData {
  settings: AppSettings
  holidays: HolidayState
  months: Record<string, MonthSchedule>
}

const AUTOSAVE_DELAY_MS = 400

export function emptyPersistedData(): PersistedData {
  return { settings: defaultSettings(), holidays: emptyHolidayState(), months: {} }
}

function parseStored(adapter: StorageAdapter, key: string): unknown {
  const raw = adapter.read(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export interface LoadResult {
  data: PersistedData
  warnings: string[]
  storageWarning: string | null
}

/**
 * Runs every stored record through its migration once, then writes the schema
 * version back so a later load knows what it is looking at.
 */
export function loadPersistedData(adapter: StorageAdapter): LoadResult {
  const warnings: string[] = []

  const settings = migrateSettings(parseStored(adapter, STORAGE_KEYS.settings))
  warnings.push(...settings.warnings)

  const holidays = migrateHolidays(parseStored(adapter, STORAGE_KEYS.holidays))
  warnings.push(...holidays.warnings)

  const months: Record<string, MonthSchedule> = {}
  for (const monthKey of listStoredMonthKeys(adapter)) {
    const migrated = migrateMonth(parseStored(adapter, monthStorageKey(monthKey)), monthKey)
    warnings.push(...migrated.warnings)
    months[monthKey] = migrated.data
  }

  writeJson(adapter, STORAGE_KEYS.meta, { schemaVersion: SCHEMA_VERSION } satisfies MetaRecord)

  return {
    data: { settings: settings.data, holidays: holidays.data, months },
    warnings,
    storageWarning: describeStorageProblem(adapter),
  }
}

function describeStorageProblem(adapter: StorageAdapter): string | null {
  switch (adapter.problem) {
    case 'unavailable':
      return 'Browser storage is not available, so your work is being kept in memory only. Download a backup before you close this tab.'
    case 'quota':
      return 'Browser storage is full, so the latest changes are being kept in memory only. Download a backup, then remove an old month to free space.'
    case 'unknown':
      return 'Browser storage refused a write, so your work is being kept in memory only. Download a backup before you close this tab.'
    default:
      return null
  }
}

export interface UsePlannerPersistence {
  data: PersistedData
  status: SaveStatus
  isSaved: boolean
  storageWarning: string | null
  isPersistent: boolean
  warnings: string[]
  save: (next: PersistedData) => void
  replaceAll: (next: PersistedData) => void
  resetAll: () => PersistedData
  applyBackup: (text: string) => PersistedData | null
}

/**
 * Reads through the migration path on the first render (so there is no empty
 * flash) and debounces writes back. The adapter keeps working when storage is
 * unavailable or full, so the app only surfaces a warning banner instead of
 * breaking.
 */
export function usePlannerPersistence(adapter?: StorageAdapter): UsePlannerPersistence {
  const resolved = useMemo(() => adapter ?? createStorageAdapter(), [adapter])
  const initial = useMemo(() => loadPersistedData(resolved), [resolved])

  const [data, setData] = useState<PersistedData>(initial.data)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [isSaved, setIsSaved] = useState(true)
  const [storageWarning, setStorageWarning] = useState<string | null>(initial.storageWarning)
  const [warnings] = useState<string[]>(initial.warnings)

  const timer = useRef<number | null>(null)

  const flush = useCallback(
    (next: PersistedData) => {
      writeJson(resolved, STORAGE_KEYS.settings, next.settings)
      writeJson(resolved, STORAGE_KEYS.holidays, next.holidays)

      const kept = new Set<string>()
      for (const [monthKey, schedule] of Object.entries(next.months)) {
        const key = monthStorageKey(monthKey)
        kept.add(key)
        writeJson(resolved, key, schedule)
      }
      for (const key of resolved.keys()) {
        if (key.startsWith(STORAGE_KEYS.monthPrefix) && !kept.has(key)) resolved.remove(key)
      }
      writeJson(resolved, STORAGE_KEYS.meta, { schemaVersion: SCHEMA_VERSION } satisfies MetaRecord)

      setStorageWarning(describeStorageProblem(resolved))
    },
    [resolved],
  )

  const save = useCallback(
    (next: PersistedData) => {
      setData(next)
      setStatus('pending')
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        setStatus('saving')
        flush(next)
        setStatus('saved')
        setIsSaved(true)
      }, AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  const replaceAll = useCallback(
    (next: PersistedData) => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
      setData(next)
      flush(next)
      setStatus('saved')
      setIsSaved(true)
    },
    [flush],
  )

  const resetAll = useCallback(() => {
    const fresh = emptyPersistedData()
    replaceAll(fresh)
    return fresh
  }, [replaceAll])

  const applyBackup = useCallback(
    (text: string): PersistedData | null => {
      try {
        const restored = parseBackup(text)
        replaceAll(restored)
        return restored
      } catch {
        return null
      }
    },
    [replaceAll],
  )

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  return {
    data,
    status,
    isSaved,
    storageWarning,
    isPersistent: resolved.isPersistent && storageWarning === null,
    warnings,
    save,
    replaceAll,
    resetAll,
    applyBackup,
  }
}
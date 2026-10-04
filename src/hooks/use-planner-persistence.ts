import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  STORAGE_KEYS,
  holidayContextFrom,
  migrateHolidays,
  migrateMonth,
  migrateSettings,
  monthStorageKey,
  emptyHolidayState,
  parseBackup,
  type MetaRecord,
} from '@/lib/storage'
import {
  createStorageAdapter,
  listStoredMonthKeys,
  writeJson,
  type StorageAdapter,
} from '@/lib/storage-adapter'
import { SCHEMA_VERSION, defaultSettings, type AppSettings, type MonthSchedule } from '@/lib/schema'
import type { HolidayState } from '@/lib/working-days'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved'

export interface PersistedData {
  settings: AppSettings
  holidays: HolidayState
  months: Record<string, MonthSchedule>
}

export interface UsePlannerPersistence {
  data: PersistedData
  status: SaveStatus
  /** True once the debounced write has completed at least once. */
  isSaved: boolean
  /** Set when storage is unavailable or full; the UI shows a persistent banner. */
  storageWarning: string | null
  isPersistent: boolean
  warnings: string[]
  save: (next: Partial<PersistedData>) => void
  replaceAll: (next: PersistedData) => void
  resetAll: () => void
  loadBackupText: (text: string) => { ok: boolean; message: string }
  applyBackup: (text: string) => PersistedData | null
}

const AUTOSAVE_DELAY_MS = 400

function parseStored(adapter: StorageAdapter, key: string): { raw: unknown; wasPresent: boolean } {
  const raw = adapter.read(key)
  if (raw === null) return { raw: null, wasPresent: false }
  try {
    return { raw: JSON.parse(raw) as unknown, wasPresent: true }
  } catch {
    return { raw: null, wasPresent: false }
  }
}

/** Runs every migration once at start-up and reports anything worth telling the user. */
export function loadPersistedData(adapter: StorageAdapter): {
  data: PersistedData
  warnings: string[]
} {
  const warnings: string[] = []

  const settingsResult = migrateSettings(parseStored(adapter, STORAGE_KEYS.settings).raw)
  warnings.push(...settingsResult.warnings)

  const holidaysResult = migrateHolidays(parseStored(adapter, STORAGE_KEYS.holidays).raw)
  warnings.push(...holidaysResult.warnings)

  const months: Record<string, MonthSchedule> = {}
  for (const monthKey of listStoredMonthKeys(adapter)) {
    const result = migrateMonth(parseStored(adapter, monthStorageKey(monthKey)).raw, monthKey)
    warnings.push(...result.warnings)
    months[monthKey] = result.data
  }

  writeJson(adapter, STORAGE_KEYS.meta, {
    schemaVersion: SCHEMA_VERSION,
  } satisfies MetaRecord)

  return { data: { settings: settingsResult.data, holidays: holidaysResult.data, months }, warnings }
}

function emptyData(): PersistedData {
  return { settings: defaultSettings(), holidays: emptyHolidayState(), months: {} }
}

/**
 * Reads every key through the migration path and debounces writes back. The
 * adapter keeps working when storage is unavailable or full, so the app never
 * breaks because of it: it only surfaces a warning banner.
 */
export function usePlannerPersistence(adapter?: StorageAdapter): UsePlannerPersistence {
  const resolvedAdapter = useMemo(() => adapter ?? createStorageAdapter(), [adapter])
  const [data, setData] = useState<PersistedData>(() => emptyData())
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [isSaved, setIsSaved] = useState(false)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const hydrated = useRef(false)
  const timer = useRef<number | null>(null)
  const pending = useRef<PersistedData | null>(null)

  // Hydrate once. The adapter is stable, so this never re-runs.
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const loaded = loadPersistedData(resolvedAdapter)
    setData(loaded.data)
    setWarnings(loaded.warnings)
    setStorageWarning(describeStorageProblem(resolvedAdapter))
    setStatus('saved')
    setIsSaved(true)
  }, [resolvedAdapter])

  const flush = useCallback(
    (next: PersistedData) => {
      const settingsOk = writeJson(resolvedAdapter, STORAGE_KEYS.settings, next.settings)
      const holidaysOk = writeJson(resolvedAdapter, STORAGE_KEYS.holidays, next.holidays)

      const keptKeys = new Set<string>()
      const monthOk = Object.entries(next.months).map(([monthKey, schedule]) => {
        const key = monthStorageKey(monthKey)
        keptKeys.add(key)
        return writeJson(resolvedAdapter, key, schedule)
      })
      for (const key of resolvedAdapter.keys()) {
        if (key.startsWith(STORAGE_KEYS.monthPrefix) && !keptKeys.has(key)) resolvedAdapter.remove(key)
      }

      writeJson(resolvedAdapter, STORAGE_KEYS.meta, { schemaVersion: SCHEMA_VERSION } satisfies MetaRecord)

      setStatus('saved')
      setIsSaved(true)
      setStorageWarning(describeStorageProblem(resolvedAdapter))
      return settingsOk && holidaysOk && monthOk.every(Boolean)
    },
    [resolvedAdapter],
  )

  const save = useCallback(
    (next: Partial<PersistedData>) => {
      setData((current) => {
        const merged = { ...current, ...next }
        pending.current = merged
        return merged
      })
      setStatus('pending')
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        const toWrite = pending.current
        pending.current = null
        if (toWrite) {
          setStatus('saving')
          flush(toWrite)
        }
      }, AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  const replaceAll = useCallback(
    (next: PersistedData) => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
      pending.current = null
      setData(next)
      flush(next)
    },
    [flush],
  )

  const resetAll = useCallback(() => {
    const fresh = emptyData()
    replaceAll(fresh)
  }, [replaceAll])

  const loadBackupText = useCallback(
    (text: string) => {
      try {
        const restored = parseBackup(text)
        return { ok: true, message: `Backup ready: ${Object.keys(restored.months).length} month(s) found.` }
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'The backup file could not be read.',
        }
      }
    },
    [],
  )

  const applyBackup = useCallback(
    (text: string): PersistedData | null => {
      try {
        const restored = parseBackup(text)
        const next: PersistedData = {
          settings: restored.settings,
          holidays: restored.holidays,
          months: restored.months,
        }
        setWarnings((current) => [...current, ...restored.warnings])
        replaceAll(next)
        return next
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
    isPersistent: resolvedAdapter.isPersistent && storageWarning === null,
    warnings,
    save,
    replaceAll,
    resetAll,
    loadBackupText,
    applyBackup,
  }
}

function describeStorageProblem(adapter: StorageAdapter): string | null {
  switch (adapter.problem) {
    case 'unavailable':
      return 'Browser storage is not available, so your work is being kept in memory only. Download a backup before you close this tab.'
    case 'quota':
      return 'Browser storage is full, so the latest changes are being kept in memory only. Download a backup, then remove an old month to free space.'
    case 'unknown':
      return 'Browser storage refused a write. Your work is being kept in memory only. Download a backup before you close this tab.'
    default:
      return null
  }
}

export { holidayContextFrom }
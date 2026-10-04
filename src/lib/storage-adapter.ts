import { STORAGE_KEYS, monthKeyFromStorageKey } from './storage'

export type StorageProblem = 'unavailable' | 'quota' | 'unknown'

export interface StorageAdapter {
  /** False when the browser refused access; the app then runs in memory. */
  isPersistent: boolean
  problem: StorageProblem | null
  read(key: string): string | null
  write(key: string, value: string): boolean
  remove(key: string): void
  keys(): string[]
}

function detectProblem(error: unknown): StorageProblem {
  if (!(error instanceof Error)) return 'unknown'
  if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota'
  if (error.name === 'SecurityError') return 'unavailable'
  return 'unknown'
}

/**
 * Reads through a working probe so a disabled or private-mode storage never
 * crashes the app. Writes are always guarded: on failure the adapter flips to
 * memory-only and the UI shows a persistent banner.
 */
export function createStorageAdapter(source?: Storage | null): StorageAdapter {
  const memory = new Map<string, string>()
  let persistent = false
  let problem: StorageProblem | null = null

  const probeTarget = (): Storage | null => {
    if (source === null) return null
    if (source) return source
    if (typeof window === 'undefined') return null
    return window.localStorage
  }

  const initial = probeTarget()
  if (initial === null) {
    problem = source === null ? 'unavailable' : problem
  } else {
    try {
      const probeKey = `${STORAGE_KEYS.meta}:probe`
      initial.setItem(probeKey, '1')
      initial.removeItem(probeKey)
      persistent = true
    } catch (error) {
      persistent = false
      problem = detectProblem(error)
    }
  }

  const resolve = (): Storage | null => {
    if (!persistent || problem !== null) return null
    try {
      return probeTarget()
    } catch {
      return null
    }
  }

  return {
    get isPersistent() {
      return persistent && problem === null
    },
    get problem() {
      return problem
    },
    read(key) {
      const storage = resolve()
      if (!storage) return memory.get(key) ?? null
      try {
        return storage.getItem(key)
      } catch (error) {
        problem = detectProblem(error)
        return memory.get(key) ?? null
      }
    },
    write(key, value) {
      memory.set(key, value)
      const storage = resolve()
      if (!storage) return false
      try {
        storage.setItem(key, value)
        return true
      } catch (error) {
        problem = detectProblem(error)
        persistent = false
        return false
      }
    },
    remove(key) {
      memory.delete(key)
      const storage = resolve()
      if (!storage) return
      try {
        storage.removeItem(key)
      } catch (error) {
        problem = detectProblem(error)
      }
    },
    keys() {
      const storage = resolve()
      const fromMemory = new Set(memory.keys())
      if (!storage) return [...fromMemory]
      try {
        const stored: string[] = []
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index)
          if (key !== null) stored.push(key)
        }
        return [...new Set([...stored, ...fromMemory])]
      } catch (error) {
        problem = detectProblem(error)
        return [...fromMemory]
      }
    },
  }
}

export function writeJson(adapter: StorageAdapter, key: string, value: unknown): boolean {
  try {
    return adapter.write(key, JSON.stringify(value))
  } catch {
    return false
  }
}

export function listStoredMonthKeys(adapter: StorageAdapter): string[] {
  const keys: string[] = []
  for (const key of adapter.keys()) {
    const monthKey = monthKeyFromStorageKey(key)
    if (monthKey) keys.push(monthKey)
  }
  return keys.sort()
}
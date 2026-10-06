import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { usePlannerPersistence } from '@/hooks/use-planner-persistence'
import { monthLabel, parseMonthKey, todayIso, toMonthKey } from '@/lib/date'
import { buildDocumentModel } from '@/lib/document-model'
import { downloadBlob } from '@/lib/file-download'
import { SAMPLE_MONTH_KEY } from '@/lib/seed'
import { buildBackup, holidayContextFrom } from '@/lib/storage'
import type { AppSettings, MonthSchedule } from '@/lib/schema'
import type { HolidayContext } from '@/lib/working-days'
import { reduce, type PlannerAction, type PlannerState } from './planner-reducer'

/** The reducer stays pure; this action just installs an already-computed state. */
interface ApplyAction {
  type: '@@apply'
  state: PlannerState
}

type InternalAction = ApplyAction

function install(state: PlannerState): InternalAction {
  return { type: '@@apply', state }
}

function installNewState(_current: PlannerState, action: InternalAction): PlannerState {
  return action.state
}

export interface RunOptions {
  /** When set, the toast offers an undo that restores the previous state. */
  undo?: boolean
  undoLabel?: string
}

export interface PlannerApi {
  state: PlannerState
  monthKey: string
  setMonthKey: (monthKey: string) => void
  goToPreviousMonth: () => void
  goToNextMonth: () => void
  goToToday: () => void
  /** False until the month has been set up; drives the empty state. */
  isMonthInitialised: boolean
  schedule: MonthSchedule | null
  context: HolidayContext
  documentModel: ReturnType<typeof buildDocumentModel> | null
  settings: AppSettings
  run: (action: PlannerAction, options?: RunOptions) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  loadSample: () => void
  saveStatus: 'idle' | 'pending' | 'saving' | 'saved'
  storageWarning: string | null
  migrationWarnings: string[]
  downloadBackup: () => void
  restoreBackupFromText: (text: string) => boolean
  resetEverything: () => void
}

const PlannerContext = createContext<PlannerApi | null>(null)

export function usePlanner(): PlannerApi {
  const value = use(PlannerContext)
  if (!value) throw new Error('usePlanner must be used inside <PlannerProvider>')
  return value
}

function shiftMonthKeyBy(key: string, delta: number): string {
  const parts = parseMonthKey(key)
  if (!parts) return key
  const zeroBased = parts.month - 1 + delta
  const year = parts.year + Math.floor(zeroBased / 12)
  const month = ((zeroBased % 12) + 12) % 12
  return toMonthKey(year, month + 1)
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const persistence = usePlannerPersistence()
  const [state, dispatch] = useReducer(installNewState, persistence.data)
  const [monthKey, setMonthKeyState] = useState(() => todayIso().slice(0, 7))

  // Autosave: one write per state change, debounced by the persistence hook.
  const { save: persist } = persistence
  useEffect(() => {
    persist({ settings: state.settings, holidays: state.holidays, months: state.months })
  }, [state, persist])

  // The newest state, readable from callbacks that must not re-create on change.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const undoStateRef = useRef<PlannerState | null>(null)

  const run = useCallback((action: PlannerAction, options: RunOptions = {}) => {
    const previous = stateRef.current
    const result = reduce(previous, action)
    if (result.state === previous && !result.message) return

    stateRef.current = result.state
    dispatch(install(result.state))

    if (result.message) {
      if (options.undo) undoStateRef.current = previous
      const canUndo = options.undo === true
      toast.success(result.message, {
        ...(canUndo
          ? {
              action: {
                label: options.undoLabel ?? 'Undo',
                onClick: () => {
                  const target = undoStateRef.current
                  if (!target) return
                  undoStateRef.current = null
                  stateRef.current = target
                  dispatch(install(target))
                  toast('Change undone.', { icon: '↩' })
                },
              },
            }
          : {}),
      })
    }
  }, [])

  const context = useMemo<HolidayContext>(
    () => holidayContextFrom(state.holidays, state.settings.weeklyOffDays),
    [state.holidays, state.settings.weeklyOffDays],
  )

  const schedule = state.months[monthKey] ?? null

  const documentModel = useMemo(
    () => (schedule ? buildDocumentModel({ settings: state.settings, schedule, context }) : null),
    [schedule, state.settings, context],
  )

  const setMonthKey = useCallback((next: string) => {
    if (!parseMonthKey(next)) return
    setMonthKeyState(next)
  }, [])

  const downloadBackup = useCallback(() => {
    const current = stateRef.current
    const payload = buildBackup({
      settings: current.settings,
      holidays: current.holidays,
      months: current.months,
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `Monitoring_Schedule_Backup_${todayIso()}.json`)
    toast.success('Backup downloaded. Keep it somewhere safe.')
  }, [])

  const api = useMemo<PlannerApi>(
    () => ({
      state,
      monthKey,
      setMonthKey,
      goToPreviousMonth: () => setMonthKeyState((current) => shiftMonthKeyBy(current, -1)),
      goToNextMonth: () => setMonthKeyState((current) => shiftMonthKeyBy(current, 1)),
      goToToday: () => setMonthKeyState(todayIso().slice(0, 7)),
      isMonthInitialised: schedule !== null,
      schedule,
      context,
      documentModel,
      settings: state.settings,
      run,
      updateSettings: (patch: Partial<AppSettings>) => run({ type: 'settings/update', patch }),
      loadSample: () => {
        const result = reduce(stateRef.current, { type: 'month/loadSample', monthKey: SAMPLE_MONTH_KEY })
        stateRef.current = result.state
        dispatch(install(result.state))
        setMonthKeyState(SAMPLE_MONTH_KEY)
        toast.success('Loaded the October 2026 sample.')
      },
      saveStatus: persistence.status,
      storageWarning: persistence.storageWarning,
      migrationWarnings: persistence.warnings,
      downloadBackup,
      restoreBackupFromText: (text: string) => {
        const restored = persistence.applyBackup(text)
        if (!restored) {
          toast.error('That file could not be read as a Monitoring Schedule Planner backup.')
          return false
        }
        stateRef.current = restored
        dispatch(install(restored))
        toast.success('Backup restored. Everything you had is back.')
        return true
      },
      resetEverything: () => {
        const fresh = persistence.resetAll()
        stateRef.current = fresh
        dispatch(install(fresh))
        toast.success('All data reset to defaults.')
      },
    }),
    [state, monthKey, setMonthKey, schedule, context, documentModel, run, persistence, downloadBackup],
  )

  return <PlannerContext value={api}>{children}</PlannerContext>
}

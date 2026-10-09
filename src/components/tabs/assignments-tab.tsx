import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  Calendar,
  Edit3,
  GripVertical,
  Info,
  MapPin,
  RotateCcw,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatRangeText } from '@/lib/date-format'
import { isValidIso, longDateLabel } from '@/lib/date'
import type { DateRange } from '@/lib/date-format'
import { printableOfficers } from '@/lib/document-model'
import {
  getBranchAccent,
} from '@/lib/officer-colors'
import { OfficerAvatar, OfficerKindBadge } from '@/components/officer-badge'
import type { AppSettings, MonthSchedule, WindowKey } from '@/lib/schema'
import type { HolidayContext } from '@/lib/working-days'
import { countWorkingDays, isWorkingDay } from '@/lib/working-days'
import { cn } from '@/lib/utils'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const WINDOW_KEYS: WindowKey[] = ['one', 'two']
const QUICK_BRANCHES = ['Issue-Based Monitoring', 'Special Visit at']
const SPECIAL_VISIT_SUGGESTIONS = [
  'Special Visit at Lalmonirhat',
  'Special Visit at Rangpur',
  'Special Visit at Kurigram',
]

export interface AssignmentsTabProps {
  schedule: MonthSchedule
  settings: AppSettings
  context: HolidayContext
  warnings: Array<{ id: string; message: string }>
  selectedOfficerId: string | null
  onSelectOfficer: (officerId: string) => void
  onSetBranch: (officerId: string, windowKey: WindowKey, branch: string) => void
  onSetCustomRanges: (officerId: string, windowKey: WindowKey, ranges: DateRange[]) => void
  onSwapBranches: (
    fromWindow: WindowKey,
    fromOfficerId: string,
    toWindow: WindowKey,
    toOfficerId: string,
  ) => void
  onRememberBranch: (branch: string) => void
  className?: string
}

export function AssignmentsTab({
  schedule,
  settings,
  context,
  warnings,
  selectedOfficerId,
  onSelectOfficer,
  onSetBranch,
  onSetCustomRanges,
  onSwapBranches,
  onRememberBranch,
  className,
}: AssignmentsTabProps) {
  const officers = printableOfficers(schedule)
  const [activeCellId, setActiveCellId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveCellId(String(event.active.id))
  }

  function handleDragCancel() {
    setActiveCellId(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCellId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const [fromWindow, fromOfficerId] = String(active.id).split('::') as [WindowKey, string]
    const [toWindow, toOfficerId] = String(over.id).split('::') as [WindowKey, string]

    if (fromWindow === toWindow && fromOfficerId === toOfficerId) return

    onSwapBranches(fromWindow, fromOfficerId, toWindow, toOfficerId)
  }

  const activeBranchData = useMemo(() => {
    if (!activeCellId) return null
    const [windowKey, officerId] = activeCellId.split('::') as [WindowKey, string]
    const officer = officers.find((o) => o.id === officerId)
    const branch = schedule.assignments[officerId]?.[windowKey]?.branch ?? ''
    return {
      officerId,
      officerName: officer?.name ?? 'Officer',
      windowKey,
      branch,
    }
  }, [activeCellId, officers, schedule.assignments])

  if (officers.length === 0) {
    return (
      <Card className={cn('flex h-full w-full flex-col min-h-0 bg-background border-border/60', className)}>
        <CardHeader className="px-6 pt-5 pb-3 shrink-0">
          <CardTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 text-sm text-muted-foreground flex-1">
          Every officer in this month is crossed out, so there is nothing to print yet. Restore one from
          the Officers panel, or add a temporary officer.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('flex h-full w-full flex-col min-h-0 bg-background border-border/60 shadow-xs', className)}>
      <CardHeader className="shrink-0 px-6 pt-5 pb-3">
        <CardTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Assignments
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 px-6 pb-6">
        {/* Info / Warning Banner matching designer mockup */}
        {warnings.length > 0 ? (
          <div className="shrink-0 space-y-2 rounded-xl border border-sky-200/90 bg-sky-50/80 p-3.5 text-xs sm:text-sm text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/40 dark:text-sky-200 shadow-2xs">
            {warnings.map((warning) => (
              <div key={warning.id} className="flex items-start gap-2.5">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                <span className="leading-relaxed font-normal">{warning.message}</span>
              </div>
            ))}
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/70 bg-card shadow-2xs">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[28%]" />
                <col className="w-[14.5%]" />
                <col className="w-[28%]" />
                <col className="w-[14.5%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-xs border-b border-border/70 shadow-2xs">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <th scope="col" className="w-[15%] py-3 pl-4 pr-3 bg-card/95">
                    Officer
                  </th>
                  <th scope="col" className="w-[28%] py-3 px-3 bg-card/95">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-blue-500 shrink-0 shadow-xs" aria-hidden />
                      <span className="text-blue-700 dark:text-blue-300 font-bold">Window 1 branch</span>
                    </div>
                  </th>
                  <th scope="col" className="w-[14.5%] py-3 px-3 bg-card/95">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-blue-500 shrink-0 shadow-xs" aria-hidden />
                      <span className="text-blue-700 dark:text-blue-300 font-bold">Window 1 dates</span>
                    </div>
                  </th>
                  <th scope="col" className="w-[28%] py-3 px-3 bg-card/95">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0 shadow-xs" aria-hidden />
                      <span className="text-emerald-700 dark:text-emerald-300 font-bold">Window 2 branch</span>
                    </div>
                  </th>
                  <th scope="col" className="w-[14.5%] py-3 pl-3 pr-4 bg-card/95">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0 shadow-xs" aria-hidden />
                      <span className="text-emerald-700 dark:text-emerald-300 font-bold">Window 2 dates</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {officers.map((officer, officerIndex) => {
                  const one = schedule.assignments[officer.id]?.one ?? { branch: '', customRanges: [] }
                  const two = schedule.assignments[officer.id]?.two ?? { branch: '', customRanges: [] }

                  return (
                    <tr
                      key={officer.id}
                      className={cn(
                        'transition-colors align-top hover:bg-muted/15',
                        selectedOfficerId === officer.id && 'bg-primary/5',
                      )}
                    >
                      {/* Officer Column with styled Avatar & Kind Badge */}
                      <th scope="row" className="py-3.5 pl-4 pr-3 text-left font-normal align-top">
                        <div className="flex items-center gap-2.5 min-w-0 pt-1">
                          <OfficerAvatar officer={officer} />
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => onSelectOfficer(officer.id)}
                              className="block truncate text-left text-sm font-semibold text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                              title={`Select ${officer.name}`}
                            >
                              {officer.name}
                            </button>
                            <OfficerKindBadge kind={officer.kind} className="mt-1" />
                          </div>
                        </div>
                      </th>

                      {/* Windows 1 and 2 cells */}
                      {WINDOW_KEYS.map((windowKey) => (
                        <AssignmentCells
                          key={windowKey}
                          officerId={officer.id}
                          officerName={officer.name}
                          officerIndex={officerIndex}
                          windowKey={windowKey}
                          branch={windowKey === 'one' ? one.branch : two.branch}
                          customRanges={windowKey === 'one' ? one.customRanges : two.customRanges}
                          windowRange={schedule.windows[windowKey]}
                          context={context}
                          rememberedBranches={settings.recentBranchNames}
                          activeDragId={activeCellId}
                          onSetBranch={onSetBranch}
                          onSetCustomRanges={onSetCustomRanges}
                          onRememberBranch={onRememberBranch}
                        />
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeBranchData ? (
              <div className="flex max-w-sm items-center gap-3 rounded-xl border border-primary/50 bg-card/95 p-3 text-sm shadow-xl backdrop-blur-xs ring-2 ring-primary/40 cursor-grabbing pointer-events-none select-none">
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground truncate">{activeBranchData.officerName}</span>
                    <span>·</span>
                    <span>Window {activeBranchData.windowKey === 'one' ? '1' : '2'}</span>
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground mt-0.5">
                    {activeBranchData.branch.trim() !== '' ? (
                      activeBranchData.branch
                    ) : (
                      <span className="italic text-muted-foreground font-normal">(Empty assignment)</span>
                    )}
                  </p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  )
}

function AssignmentCells({
  officerId,
  officerName,
  officerIndex,
  windowKey,
  branch,
  customRanges,
  windowRange,
  context,
  rememberedBranches,
  activeDragId,
  onSetBranch,
  onSetCustomRanges,
  onRememberBranch,
}: {
  officerId: string
  officerName: string
  officerIndex: number
  windowKey: WindowKey
  branch: string
  customRanges: DateRange[]
  windowRange: DateRange
  context: HolidayContext
  rememberedBranches: string[]
  activeDragId: string | null
  onSetBranch: (officerId: string, windowKey: WindowKey, branch: string) => void
  onSetCustomRanges: (officerId: string, windowKey: WindowKey, ranges: DateRange[]) => void
  onRememberBranch: (branch: string) => void
}) {
  const displayText = useMemo(() => {
    const ranges = customRanges.length > 0 ? customRanges : [windowRange]
    return formatRangeText(ranges, {
      splitAroundHolidays: false,
      context,
    })
  }, [customRanges, windowRange, context])

  const workingDaysCount = useMemo(() => {
    const ranges = customRanges.length > 0 ? customRanges : [windowRange]
    let total = 0
    for (const r of ranges) {
      total += countWorkingDays(r.start, r.end, context)
    }
    return total
  }, [customRanges, windowRange, context])

  const cellId = `${windowKey}::${officerId}`

  return (
    <>
      <td className="py-2.5 px-3 align-top">
        <BranchCell
          cellId={cellId}
          officerName={officerName}
          officerIndex={officerIndex}
          windowKey={windowKey}
          value={branch}
          rememberedBranches={rememberedBranches}
          activeDragId={activeDragId}
          onChange={(next) => onSetBranch(officerId, windowKey, next)}
          onCommit={() => {
            if (branch.trim() !== '') onRememberBranch(branch)
          }}
        />
      </td>
      <td className={cn('py-2.5 px-3 align-top', windowKey === 'two' && 'pr-4')}>
        <DatesCell
          windowKey={windowKey}
          displayText={displayText}
          workingDaysCount={workingDaysCount}
          followsWindow={customRanges.length === 0}
          windowRange={windowRange}
          customRanges={customRanges}
          context={context}
          active={false}
          onChange={(ranges) => onSetCustomRanges(officerId, windowKey, ranges)}
        />
      </td>
    </>
  )
}

function BranchCell({
  cellId,
  officerName,
  officerIndex,
  windowKey,
  value,
  rememberedBranches,
  activeDragId,
  onChange,
  onCommit,
}: {
  cellId: string
  officerName: string
  officerIndex: number
  windowKey: WindowKey
  value: string
  rememberedBranches: string[]
  activeDragId: string | null
  onChange: (next: string) => void
  onCommit: () => void
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: cellId,
    data: { cellId, officerName, windowKey, value },
  })

  const isDragging = activeDragId === cellId
  const isDropTarget = isOver && activeDragId !== null && activeDragId !== cellId

  const [draft, setDraft] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Follow the stored value whenever it changes underneath the draft.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  // Automatically adjust textarea height to fit content smoothly.
  useIsomorphicLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(22, el.scrollHeight)}px`
  }, [draft])

  const remembered = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const entry of [...rememberedBranches, ...SPECIAL_VISIT_SUGGESTIONS]) {
      const key = entry.trim().toLowerCase()
      if (key === '' || seen.has(key)) continue
      if (entry.trim() === value.trim()) continue
      seen.add(key)
      result.push(entry)
    }
    return result.slice(0, 3)
  }, [rememberedBranches, value])

  const branchAccent = useMemo(() => {
    return getBranchAccent(draft, windowKey, officerIndex)
  }, [draft, windowKey, officerIndex])

  // Location text for the subtitle row with MapPin icon
  const locationText = useMemo(() => {
    const trimmed = draft.trim()
    return trimmed || null
  }, [draft])

  return (
    <div
      ref={setDropRef}
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border bg-card p-3 transition-all w-full min-w-0 min-h-[102px]',
        'border-border/70 border-l-4',
        branchAccent.borderAccent,
        branchAccent.shadowAccent,
        isDragging && 'opacity-40 border-dashed border-primary/50 bg-muted/30 shadow-none',
        isDropTarget && 'ring-2 ring-primary ring-offset-1 bg-primary/10 shadow-sm border-primary',
        !isDragging && !isDropTarget && branchAccent.borderHover,
      )}
    >
      <div className="space-y-1 w-full min-w-0">
        {/* Top row: Colored dot + Textarea + Drag handle */}
        <div className="flex items-start gap-2 justify-between">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span
              className={cn('size-2 rounded-full mt-1.5 shrink-0 transition-colors', branchAccent.dotBg)}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                aria-label={`Branch for window ${cellId.startsWith('one') ? 1 : 2}`}
                value={draft}
                placeholder="Branch, District"
                onChange={(event) => {
                  const next = event.target.value.replace(/[\r\n]+/g, ' ')
                  setDraft(next)
                  onChange(next)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                }}
                onBlur={() => {
                  onCommit()
                }}
                className={cn(
                  'w-full resize-none overflow-hidden bg-transparent p-0 text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 leading-tight focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs',
                  isDropTarget && 'font-bold text-primary',
                )}
              />
            </div>
          </div>
          <BranchDragHandle cellId={cellId} isDragging={isDragging} />
        </div>

        {/* Second line: MapPin location info */}
        {locationText ? (
          <div className="flex items-center gap-1.5 pl-4 text-xs text-muted-foreground min-w-0">
            <MapPin className="size-3 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{locationText}</span>
          </div>
        ) : null}
      </div>

      {isDropTarget ? (
        <div className="pointer-events-none absolute -top-2 right-2 z-20 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm animate-in fade-in zoom-in-95">
          Drop to swap
        </div>
      ) : null}

      {/* Third & Fourth rows: Quick pills and recent branch suggestions */}
      <div className="space-y-1.5 mt-2 pt-1 border-t border-border/40 pl-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_BRANCHES.map((entry) => {
            const isSelected = draft.toLowerCase().includes(entry.toLowerCase())
            return (
              <button
                key={entry}
                type="button"
                onClick={() => {
                  let next: string
                  if (isSelected) {
                    next = draft
                      .replace(new RegExp(escapeRegExp(entry), 'gi'), '')
                      .replace(/\s+/g, ' ')
                      .trim()
                  } else {
                    next = draft.trim() === '' ? entry : `${draft.trim()} ${entry}`
                  }
                  setDraft(next)
                  onChange(next)
                }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer',
                  isSelected
                    ? cn(
                        'border',
                        branchAccent.pillActiveBorder,
                        branchAccent.pillActiveBg,
                        branchAccent.pillActiveText,
                      )
                    : 'border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
              >
                {isSelected ? `- ${entry}` : `+ ${entry}`}
              </button>
            )
          })}
        </div>

        {rememberedBranches.length > 0 && remembered.length > 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0 pt-0.5" aria-label="Seen before suggestions">
            <span className="shrink-0 text-muted-foreground/80 font-medium">Based on:</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {remembered.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => {
                    setDraft(entry)
                    onChange(entry)
                  }}
                  className="max-w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-muted-foreground/90 transition-colors hover:bg-accent hover:text-foreground hover:underline"
                  title={`Use "${entry}"`}
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function BranchDragHandle({ cellId, isDragging }: { cellId: string; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: cellId })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          type="button"
          {...listeners}
          {...attributes}
          aria-label="Drag this branch onto another cell to swap or reassign"
          className={cn(
            'cursor-grab touch-none rounded-md p-1 text-muted-foreground/60 hover:text-foreground shrink-0 hover:bg-muted/50 transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing',
            isDragging && 'text-foreground',
          )}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>Drag onto another branch cell to reassign or swap.</TooltipContent>
    </Tooltip>
  )
}

const WINDOW_DATES_THEMES: Record<
  WindowKey,
  {
    bg: string
    hoverBorder: string
    shadow: string
    icon: string
    buttonHover: string
  }
> = {
  one: {
    bg: 'bg-[#f0f6ff] border-[#c8ddfd] dark:bg-blue-950/25 dark:border-blue-900/40 text-slate-800 dark:text-slate-100',
    hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-800/80',
    shadow: 'shadow-[0_2px_10px_-1px_rgba(59,130,246,0.18)] hover:shadow-[0_4px_14px_-1px_rgba(59,130,246,0.28)] dark:shadow-[0_2px_10px_-1px_rgba(59,130,246,0.28)]',
    icon: 'text-blue-600 dark:text-blue-400',
    buttonHover: 'hover:bg-blue-100/70 dark:hover:bg-blue-900/40 text-slate-600 dark:text-slate-400 hover:text-blue-900 dark:hover:text-blue-100',
  },
  two: {
    bg: 'bg-[#edf7f4] border-[#cbe4db] dark:bg-emerald-950/20 dark:border-emerald-900/40 text-slate-800 dark:text-slate-100',
    hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-800/80',
    shadow: 'shadow-[0_2px_10px_-1px_rgba(16,185,129,0.18)] hover:shadow-[0_4px_14px_-1px_rgba(16,185,129,0.28)] dark:shadow-[0_2px_10px_-1px_rgba(16,185,129,0.28)]',
    icon: 'text-emerald-600 dark:text-emerald-400',
    buttonHover: 'hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 text-slate-600 dark:text-slate-400 hover:text-emerald-900 dark:hover:text-emerald-100',
  },
}

function DatesCell({
  windowKey,
  displayText,
  workingDaysCount,
  followsWindow,
  windowRange,
  customRanges,
  context,
  active,
  onChange,
}: {
  windowKey: WindowKey
  displayText: string
  workingDaysCount: number
  followsWindow: boolean
  windowRange: DateRange
  customRanges: DateRange[]
  context: HolidayContext
  active: boolean
  onChange: (ranges: DateRange[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange[]>(customRanges)
  const theme = WINDOW_DATES_THEMES[windowKey]

  // Refresh the draft from the stored ranges whenever they change.
  const [lastRanges, setLastRanges] = useState(customRanges)
  if (customRanges !== lastRanges) {
    setLastRanges(customRanges)
    setDraft(customRanges)
  }

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-xl border p-3 transition-all w-full min-w-0 min-h-[102px]',
        theme.bg,
        theme.hoverBorder,
        theme.shadow,
        active && 'ring-2 ring-primary',
      )}
      onDoubleClick={() => setOpen(true)}
    >
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Calendar className={cn('size-4 shrink-0', theme.icon)} aria-hidden />
          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{displayText || '—'}</p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 pl-5.5">
          ({workingDaysCount} working {workingDaysCount === 1 ? 'day' : 'days'})
        </p>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'mt-2 h-7 -ml-1 px-1.5 text-xs justify-start gap-1.5 font-medium transition-colors',
              theme.buttonHover,
            )}
          >
            <Edit3 className="size-3.5" />
            {followsWindow ? 'Set custom dates' : 'Edit custom dates'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] max-w-[calc(100vw-2rem)] space-y-3" align="start">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Custom visit dates</p>
            <p className="text-xs text-muted-foreground">
              Window dates are {longDateLabel(windowRange.start)} to {longDateLabel(windowRange.end)}.
            </p>
          </div>

          {draft.map((range, index) => (
            <RangeRow
              key={index}
              index={index}
              range={range}
              context={context}
              onChange={(next) =>
                setDraft((current) => current.map((entry, i) => (i === index ? next : entry)))
              }
              onRemove={() => setDraft((current) => current.filter((_, i) => i !== index))}
            />
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft((current) => [...current, { ...windowRange }])}
            >
              Add another range
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onChange(draft)
                setOpen(false)
              }}
            >
              Apply
            </Button>
          </div>

          {!followsWindow ? (
            <>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange([])
                  setDraft([])
                  setOpen(false)
                }}
              >
                <RotateCcw className="size-3.5" />
                Follow window again
              </Button>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function RangeRow({
  index,
  range,
  context,
  onChange,
  onRemove,
}: {
  index: number
  range: DateRange
  context: HolidayContext
  onChange: (range: DateRange) => void
  onRemove: () => void
}) {
  const [allowHoliday, setAllowHoliday] = useState(() => !isWorkingDay(range.start, context))
  const startOff = !isValidIso(range.start) || !isWorkingDay(range.start, context)
  const endOff = !isValidIso(range.end) || !isWorkingDay(range.end, context)

  return (
    <div className="space-y-1.5 rounded-md border p-2.5 bg-card">
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground" htmlFor={`range-start-${index}`}>
            From
          </label>
          <Input
            id={`range-start-${index}`}
            type="date"
            value={range.start}
            className="h-8 text-xs bg-background"
            onChange={(event) => onChange({ ...range, start: event.target.value })}
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground" htmlFor={`range-end-${index}`}>
            To
          </label>
          <Input
            id={`range-end-${index}`}
            type="date"
            value={range.end}
            className="h-8 text-xs bg-background"
            onChange={(event) => onChange({ ...range, end: event.target.value })}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Remove this range"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Remove this range"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {!allowHoliday && (startOff || endOff) ? (
        <p className="text-xs text-destructive">
          That range touches a holiday or weekly off day.
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={allowHoliday} onCheckedChange={(checked) => setAllowHoliday(checked === true)} />
        Allow a holiday inside this range
      </label>
    </div>
  )
}

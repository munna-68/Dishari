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
import { CalendarRange, GripVertical, Lightbulb, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
import type { AppSettings, MonthSchedule, WindowKey } from '@/lib/schema'
import type { HolidayContext } from '@/lib/working-days'
import { isWorkingDay } from '@/lib/working-days'
import { cn } from '@/lib/utils'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const WINDOW_KEYS: WindowKey[] = ['one', 'two']
const QUICK_BRANCHES = ['Issue-Based Monitoring', 'Special Visit at']
const SPECIAL_VISIT_SUGGESTIONS = ['Special Visit at Lalmonirhat', 'Special Visit at Rangpur', 'Special Visit at Kurigram']

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
      <Card className={cn('flex h-full w-full flex-col min-h-0', className)}>
        <CardHeader className="px-4 py-3 shrink-0">
          <CardTitle className="text-base">Assignments</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 text-sm text-muted-foreground flex-1">
          Every officer in this month is crossed out, so there is nothing to print yet. Restore one from
          the Officers panel, or add a temporary officer.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('flex h-full w-full flex-col min-h-0', className)}>
      <CardHeader className="shrink-0 px-4 py-3">
        <CardTitle className="text-base">Assignments</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 px-4 pb-4">
        {warnings.length > 0 ? (
          <ul className="shrink-0 space-y-1 rounded-md border border-dashed p-2 text-xs">
            {warnings.map((warning) => (
              <li key={warning.id} className="flex items-start gap-1.5">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {warning.message}
              </li>
            ))}
          </ul>
        ) : null}

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[28%]" />
                <col className="w-[14.5%]" />
                <col className="w-[28%]" />
                <col className="w-[14.5%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-card border-b shadow-xs">
                <tr className="text-left text-xs tracking-wide uppercase text-muted-foreground">
                  <th scope="col" className="w-[15%] py-2 pr-2 pl-3 font-medium bg-card">
                    Officer
                  </th>
                  <th scope="col" className="w-[28%] py-2 pr-2 font-medium bg-card">
                    Window 1 branch
                  </th>
                  <th scope="col" className="w-[14.5%] py-2 pr-2 font-medium bg-card">
                    Window 1 dates
                  </th>
                  <th scope="col" className="w-[28%] py-2 pr-2 font-medium bg-card">
                    Window 2 branch
                  </th>
                  <th scope="col" className="w-[14.5%] py-2 pr-3 font-medium bg-card">
                    Window 2 dates
                  </th>
                </tr>
              </thead>
              <tbody>
                {officers.map((officer) => {
                  const one = schedule.assignments[officer.id]?.one ?? { branch: '', customRanges: [] }
                  const two = schedule.assignments[officer.id]?.two ?? { branch: '', customRanges: [] }
                  return (
                    <tr
                      key={officer.id}
                      className={cn(
                        'border-t align-top transition-colors',
                        selectedOfficerId === officer.id && 'bg-primary/5',
                      )}
                    >
                      <th scope="row" className="py-2 pr-2 pl-3 text-left font-medium">
                        <button
                          type="button"
                          onClick={() => onSelectOfficer(officer.id)}
                          className="text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {officer.name}
                        </button>
                        {officer.kind === 'temporary' ? (
                          <Badge variant="outline" className="ml-1.5 px-1 py-0 text-[10px]">
                            Temp
                          </Badge>
                        ) : null}
                      </th>
                      {WINDOW_KEYS.map((windowKey) => (
                        <AssignmentCells
                          key={windowKey}
                          officerId={officer.id}
                          officerName={officer.name}
                          windowKey={windowKey}
                          branch={windowKey === 'one' ? one.branch : two.branch}
                          customRanges={windowKey === 'one' ? one.customRanges : two.customRanges}
                          windowRange={schedule.windows[windowKey]}
                          settings={settings}
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
              <div className="flex max-w-xs items-center gap-2 rounded-lg border bg-card/95 px-3 py-2 text-sm shadow-xl backdrop-blur-xs ring-2 ring-primary/40 cursor-grabbing pointer-events-none select-none">
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground truncate">{activeBranchData.officerName}</span>
                    <span>·</span>
                    <span>Window {activeBranchData.windowKey === 'one' ? '1' : '2'}</span>
                  </div>
                  <p className="truncate text-xs font-medium text-foreground mt-0.5">
                    {activeBranchData.branch.trim() !== '' ? (
                      activeBranchData.branch
                    ) : (
                      <span className="italic text-muted-foreground">(Empty assignment)</span>
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
  windowKey,
  branch,
  customRanges,
  windowRange,
  settings,
  context,
  rememberedBranches,
  activeDragId,
  onSetBranch,
  onSetCustomRanges,
  onRememberBranch,
}: {
  officerId: string
  officerName: string
  windowKey: WindowKey
  branch: string
  customRanges: DateRange[]
  windowRange: DateRange
  settings: AppSettings
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
      splitAroundHolidays: settings.splitRangesAroundHolidays,
      context,
    })
  }, [customRanges, windowRange, settings.splitRangesAroundHolidays, context])

  const cellId = `${windowKey}::${officerId}`

  return (
    <>
      <td className="py-2 pr-2 align-top">
        <BranchCell
          cellId={cellId}
          officerName={officerName}
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
      <td className={cn('py-2 pr-2 align-top', windowKey === 'two' && 'pr-3')}>
        <DatesCell
          displayText={displayText}
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
  windowKey,
  value,
  rememberedBranches,
  activeDragId,
  onChange,
  onCommit,
}: {
  cellId: string
  officerName: string
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

  // Automatically adjust textarea height to fit content smoothly without horizontal column resizing.
  useIsomorphicLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(34, el.scrollHeight)}px`
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

  return (
    <div
      ref={setDropRef}
      className={cn(
        'relative rounded-md p-1 -m-1 transition-all w-full min-w-0 space-y-1',
        isDragging && 'opacity-40 border border-dashed border-primary/50 bg-muted/30',
        isDropTarget && 'ring-2 ring-primary ring-offset-1 bg-primary/10 shadow-sm border border-primary',
      )}
    >
      <div className="flex items-start gap-1">
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
            'min-h-[34px] w-full resize-none overflow-hidden rounded-md border bg-transparent px-2 py-1.5 text-sm leading-snug transition-[height] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            isDropTarget && 'border-primary bg-background/80 font-medium',
          )}
        />
        <BranchDragHandle cellId={cellId} isDragging={isDragging} />
      </div>

      {isDropTarget ? (
        <div className="pointer-events-none absolute -top-2 right-2 z-20 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-xs animate-in fade-in zoom-in-95">
          Drop to swap
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
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
                'rounded-full border px-2 py-0.5 text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                isSelected
                  ? 'border-primary/40 bg-primary/10 font-medium text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {isSelected ? `- ${entry}` : `+ ${entry}`}
            </button>
          )
        })}
      </div>
      {rememberedBranches.length > 0 && remembered.length > 0 ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
          <span className="shrink-0 text-muted-foreground/75">Seen before:</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {remembered.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => {
                  setDraft(entry)
                  onChange(entry)
                }}
                className="max-w-full truncate rounded px-1 py-0.5 text-left transition-colors hover:bg-accent hover:text-foreground hover:underline"
                title={`Use "${entry}"`}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
            'mt-1 cursor-grab touch-none rounded-sm p-1 text-muted-foreground hover:text-foreground shrink-0',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing',
            isDragging && 'text-foreground',
          )}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>Drag onto another branch cell to reassign or swap.</TooltipContent>
    </Tooltip>
  )
}

function DatesCell({
  displayText,
  followsWindow,
  windowRange,
  customRanges,
  context,
  active,
  onChange,
}: {
  displayText: string
  followsWindow: boolean
  windowRange: DateRange
  customRanges: DateRange[]
  context: HolidayContext
  active: boolean
  onChange: (ranges: DateRange[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange[]>(customRanges)
  // Refresh the draft from the stored ranges whenever they change.
  const [lastRanges, setLastRanges] = useState(customRanges)
  if (customRanges !== lastRanges) {
    setLastRanges(customRanges)
    setDraft(customRanges)
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'rounded-md border p-1.5 text-sm',
          active ? 'ring-2 ring-primary' : 'bg-muted/30',
        )}
        onDoubleClick={() => setOpen(true)}
      >
        <p className="font-medium">{displayText || '—'}</p>
        <p className="text-[11px] text-muted-foreground">
          {followsWindow ? 'follows window' : 'custom range'}
        </p>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs">
            <CalendarRange />
            {followsWindow ? 'Set custom dates' : 'Edit custom dates'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3" align="start">
          <div className="space-y-1">
            <p className="text-sm font-medium">Custom visit dates</p>
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
                <RotateCcw />
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
    <div className="space-y-1.5 rounded-md border p-2">
      <div className="flex items-end gap-1.5">
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground" htmlFor={`range-start-${index}`}>
            From
          </label>
          <Input
            id={`range-start-${index}`}
            type="date"
            value={range.start}
            className="h-8"
            onChange={(event) => onChange({ ...range, start: event.target.value })}
          />
        </div>
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground" htmlFor={`range-end-${index}`}>
            To
          </label>
          <Input
            id={`range-end-${index}`}
            type="date"
            value={range.end}
            className="h-8"
            onChange={(event) => onChange({ ...range, end: event.target.value })}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label="Remove this range">
          ✕
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

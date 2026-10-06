import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  onSwapBranches: (windowKey: WindowKey, fromId: string, toId: string) => void
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

        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card border-b shadow-xs">
              <tr className="text-left text-xs tracking-wide uppercase text-muted-foreground">
                <th scope="col" className="w-44 py-2 pr-2 pl-3 font-medium bg-card">
                  Officer
                </th>
                <th scope="col" className="w-64 py-2 pr-2 font-medium bg-card">
                  Window 1 branch
                </th>
                <th scope="col" className="w-52 py-2 pr-2 font-medium bg-card">
                  Window 1 dates
                </th>
                <th scope="col" className="w-64 py-2 pr-2 font-medium bg-card">
                  Window 2 branch
                </th>
                <th scope="col" className="w-52 py-2 pr-3 font-medium bg-card">
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
                        windowKey={windowKey}
                        branch={windowKey === 'one' ? one.branch : two.branch}
                        customRanges={windowKey === 'one' ? one.customRanges : two.customRanges}
                        windowRange={schedule.windows[windowKey]}
                        settings={settings}
                        context={context}
                        rememberedBranches={settings.recentBranchNames}
                        onSetBranch={onSetBranch}
                        onSetCustomRanges={onSetCustomRanges}
                        onRememberBranch={onRememberBranch}
                        onSwapBranches={onSwapBranches}
                      />
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function AssignmentCells({
  officerId,
  windowKey,
  branch,
  customRanges,
  windowRange,
  settings,
  context,
  rememberedBranches,
  onSetBranch,
  onSetCustomRanges,
  onRememberBranch,
  onSwapBranches,
}: {
  officerId: string
  windowKey: WindowKey
  branch: string
  customRanges: DateRange[]
  windowRange: DateRange
  settings: AppSettings
  context: HolidayContext
  rememberedBranches: string[]
  onSetBranch: (officerId: string, windowKey: WindowKey, branch: string) => void
  onSetCustomRanges: (officerId: string, windowKey: WindowKey, ranges: DateRange[]) => void
  onRememberBranch: (branch: string) => void
  onSwapBranches: (windowKey: WindowKey, fromId: string, toId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const [activeId, setActiveId] = useState<string | null>(null)

  const displayText = useMemo(() => {
    const ranges = customRanges.length > 0 ? customRanges : [windowRange]
    return formatRangeText(ranges, {
      splitAroundHolidays: settings.splitRangesAroundHolidays,
      context,
    })
  }, [customRanges, windowRange, settings.splitRangesAroundHolidays, context])

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const overId = event.over ? String(event.over.id) : null
    if (!overId) return
    const [fromWindow, fromOfficer] = String(event.active.id).split('::') as [WindowKey, string]
    const [toWindow] = overId.split('::') as [WindowKey]
    if (fromWindow !== toWindow) return
    onSwapBranches(toWindow, fromOfficer, overId.split('::')[1] as string)
  }

  return (
    <>
      <td className="py-2 pr-2">
        <BranchCell
          cellId={`${windowKey}::${officerId}`}
          value={branch}
          rememberedBranches={rememberedBranches}
          onChange={(next) => onSetBranch(officerId, windowKey, next)}
          onCommit={() => {
            if (branch.trim() !== '') onRememberBranch(branch)
          }}
        />
      </td>
      <td className={cn('py-2 pr-2', windowKey === 'two' && 'pr-3')}>
        <DndContext
          sensors={sensors}
          onDragStart={(event) => setActiveId(String(event.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
        >
          <DatesCell
            displayText={displayText}
            followsWindow={customRanges.length === 0}
            windowRange={windowRange}
            customRanges={customRanges}
            context={context}
            active={activeId !== null}
            onChange={(ranges) => onSetCustomRanges(officerId, windowKey, ranges)}
          />
        </DndContext>
      </td>
    </>
  )
}

function BranchCell({
  cellId,
  value,
  rememberedBranches,
  onChange,
  onCommit,
}: {
  cellId: string
  value: string
  rememberedBranches: string[]
  onChange: (next: string) => void
  onCommit: () => void
}) {
  const [draft, setDraft] = useState(value)
  const listboxId = `${cellId}-listbox`
  // Follow the stored value whenever it changes underneath the draft.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

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
    <div className="space-y-1">
      <div className="flex items-start gap-1">
        <input
          type="text"
          role="combobox"
          aria-expanded={false}
          aria-controls={listboxId}
          aria-label={`Branch for window ${cellId.startsWith('one') ? 1 : 2}`}
          list={listboxId}
          value={draft}
          placeholder="Branch, District"
          onChange={(event) => {
            setDraft(event.target.value)
            onChange(event.target.value)
          }}
          onBlur={() => {
            onCommit()
          }}
          className="h-8 w-full rounded-md border bg-transparent px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <BranchDragHandle cellId={cellId} />
      </div>
      <datalist id={listboxId}>
        {rememberedBranches.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-1">
        {QUICK_BRANCHES.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => {
              const next = draft.trim() === '' ? entry : `${draft.trim()} ${entry}`
              setDraft(next)
              onChange(next)
            }}
            className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            + {entry}
          </button>
        ))}
      </div>
      {rememberedBranches.length > 0 && remembered.length > 0 ? (
        <p className="truncate text-[11px] text-muted-foreground" title={remembered.join(' · ')}>
          Seen before: {remembered.join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

function BranchDragHandle({ cellId }: { cellId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: cellId })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          type="button"
          {...listeners}
          {...attributes}
          aria-label="Drag this branch onto another cell to swap the two"
          className={cn(
            'mt-0.5 cursor-grab touch-none rounded-sm p-1 text-muted-foreground hover:text-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing',
            isDragging && 'text-foreground',
          )}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>Drag onto another branch cell in the same window to swap them.</TooltipContent>
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

import { useCallback, useMemo, useRef, useState } from 'react'
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
import { CSS } from '@dnd-kit/utilities'

import { DAY_LEGEND } from '@/components/calendar/calendar-legend'
import { DayCell } from '@/components/calendar/day-cell'
import { DayDetailsDialog } from '@/components/calendar/day-details-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WEEKDAY_SHORT, compareIso, eachIsoDay, isWithin, monthGridIsoDays, parseMonthKey } from '@/lib/date'
import type { DateRange } from '@/lib/date-format'
import { printableOfficers } from '@/lib/document-model'
import { getAssignmentsForDay, shiftDateByWorkingDays } from '@/lib/schedule-ops'
import { defaultSettings, type AppSettings, type MonthSchedule, type WindowKey } from '@/lib/schema'
import { cn } from '@/lib/utils'
import type { HolidayContext } from '@/lib/working-days'
import { holidayLabel, isToday, resolveDayStatus } from '@/lib/working-days'

export interface PlannerCalendarProps {
  monthKey: string
  context: HolidayContext
  windows: Record<WindowKey, DateRange>
  schedule: MonthSchedule
  settings?: AppSettings
  selectedOfficerId: string | null
  onSelectOfficer?: (officerId: string | null) => void
  onToggleDay: (iso: string) => void
  onMoveWindowEdge: (windowKey: WindowKey, edge: 'start' | 'end', iso: string) => void
  onShiftWindow: (windowKey: WindowKey, deltaWorkingDays: number) => void
  onSetBranch?: (officerId: string, windowKey: WindowKey, branch: string) => void
  onSetCustomRanges?: (officerId: string, windowKey: WindowKey, ranges: DateRange[]) => void
  onSwapBranches?: (windowKey: WindowKey, fromId: string, toId: string) => void
  onFollowWindow?: (officerId: string, windowKey: WindowKey) => void
  className?: string
}

const WINDOW_KEYS: WindowKey[] = ['one', 'two']

interface BandSegment {
  id: string
  windowKey: WindowKey
  weekIndex: number
  startColumn: number
  endColumn: number
  isFirstSegment: boolean
  isLastSegment: boolean
}

export function PlannerCalendar({
  monthKey,
  context,
  windows,
  schedule,
  settings,
  selectedOfficerId,
  onSelectOfficer,
  onToggleDay,
  onMoveWindowEdge,
  onShiftWindow,
  onSetBranch,
  onSetCustomRanges,
  onSwapBranches,
  onFollowWindow,
  className,
}: PlannerCalendarProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [activeModalDate, setActiveModalDate] = useState<string | null>(null)
  const [focusedOfficerId, setFocusedOfficerId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const activeOfficers = useMemo(() => printableOfficers(schedule), [schedule])

  const gridDays = useMemo(() => {
    const parts = parseMonthKey(monthKey)
    return parts ? monthGridIsoDays(parts.year, parts.month) : []
  }, [monthKey])

  const assignmentsByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getAssignmentsForDay>>()
    for (const iso of gridDays) {
      map.set(iso, getAssignmentsForDay(iso, schedule))
    }
    return map
  }, [gridDays, schedule])

  const officerRangeDays = useMemo(() => {
    const set = new Set<string>()
    const assignment = selectedOfficerId ? schedule.assignments[selectedOfficerId] : null
    if (!assignment) return set
    for (const windowKey of WINDOW_KEYS) {
      const entry = assignment[windowKey]
      if (!entry) continue
      const ranges = entry.customRanges.length > 0 ? entry.customRanges : [windows[windowKey]]
      for (const range of ranges) {
        if (compareIso(range.start, range.end) > 0) continue
        for (const iso of eachIsoDay(range.start, range.end)) set.add(iso)
      }
    }
    return set
  }, [selectedOfficerId, schedule, windows])

  const segments = useMemo(() => computeSegments(gridDays, windows), [gridDays, windows])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragging(null)
      const width = gridRef.current?.clientWidth ?? 0
      if (width <= 0) return
      const columns = Math.round(event.delta.x / (width / 7))
      if (columns === 0) return

      const [rawWindow, part] = String(event.active.id).split('-') as [WindowKey, string]
      const windowKey: WindowKey = rawWindow === 'two' ? 'two' : 'one'

      if (part === 'body') {
        onShiftWindow(windowKey, columns)
        return
      }

      const range = windows[windowKey]
      const from = part === 'start' ? range.start : range.end
      const target = shiftDateByWorkingDays(from, columns, context)
      if (target === null) return
      onMoveWindowEdge(windowKey, part === 'start' ? 'start' : 'end', target)
    },
    [windows, context, onMoveWindowEdge, onShiftWindow],
  )

  return (
    <Card className={cn('flex min-h-0 flex-col', className)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <CardTitle className="text-base">Calendar</CardTitle>

          {onSelectOfficer ? (
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                Officer:
              </span>
              <Select
                value={selectedOfficerId ?? 'all'}
                onValueChange={(val) => onSelectOfficer(val === 'all' ? null : val)}
              >
                <SelectTrigger size="sm" className="h-7 w-[160px] sm:w-[190px] text-xs">
                  <SelectValue placeholder="All officers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-medium">
                    All officers ({activeOfficers.length})
                  </SelectItem>
                  {activeOfficers.map((officer) => (
                    <SelectItem key={officer.id} value={officer.id} className="text-xs">
                      {officer.name} {officer.kind === 'temporary' ? '(Temp)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOfficerId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onSelectOfficer(null)}
                >
                  Show all
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <CalendarLegend />
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_SHORT.map((label, index) => (
            <div
              key={label}
              className={cn(
                'rounded-md bg-muted/60 px-1 py-1.5 text-center text-[11px] font-semibold tracking-wide uppercase',
                index >= 5 && 'bg-weekend text-muted-foreground',
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={(event) => setDragging(String(event.active.id))}
          onDragCancel={() => setDragging(null)}
          onDragEnd={handleDragEnd}
        >
          <div ref={gridRef} className="relative grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
            {gridDays.map((iso) => {
              const status = resolveDayStatus(iso, context)
              return (
                <DayCell
                  key={iso}
                  iso={iso}
                  date={Number(iso.slice(8, 10))}
                  inMonth={iso.startsWith(monthKey)}
                  status={status}
                  holidayName={holidayLabel(status)}
                  bengaliName={status.kind === 'holiday' ? (status.holiday.nameBn?.trim() || null) : null}
                  isToday={isToday(iso)}
                  inWindowOne={isWithin(iso, windows.one.start, windows.one.end)}
                  inWindowTwo={isWithin(iso, windows.two.start, windows.two.end)}
                  isOfficerRange={officerRangeDays.has(iso)}
                  assignments={assignmentsByDay.get(iso) ?? []}
                  selectedOfficerId={selectedOfficerId}
                  onClick={() => {
                    setActiveModalDate(iso)
                    setFocusedOfficerId(null)
                  }}
                />
              )
            })}

            {/* Bands sit on their own layer so dragging never fights a date click. */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-7 grid-rows-6 gap-1">
              {segments.map((segment) => (
                <BandSegmentView
                  key={segment.id}
                  segment={segment}
                  range={windows[segment.windowKey]}
                  draggingId={dragging}
                  gridDays={gridDays}
                  context={context}
                />
              ))}
            </div>
          </div>
        </DndContext>

        <p className="text-xs text-muted-foreground">
          Click any date to expand details, view or edit officer branch assignments, and adjust holiday status. Drag a band end to move that window edge, or drag the middle of a band to shift the window.
        </p>
      </CardContent>

      {/* Google Calendar-style details modal */}
      {activeModalDate ? (
        <DayDetailsDialog
          open={activeModalDate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setActiveModalDate(null)
              setFocusedOfficerId(null)
            }
          }}
          iso={activeModalDate}
          focusedOfficerId={focusedOfficerId}
          schedule={schedule}
          settings={settings ?? defaultSettings()}
          context={context}
          onNavigateDate={(nextIso) => {
            setActiveModalDate(nextIso)
            setFocusedOfficerId(null)
          }}
          onSetBranch={onSetBranch ?? (() => {})}
          onSetCustomRanges={onSetCustomRanges ?? (() => {})}
          onSwapBranches={onSwapBranches}
          onFollowWindow={onFollowWindow}
          onToggleDay={onToggleDay}
        />
      ) : null}
    </Card>
  )
}

/** One band segment per calendar week that the window touches. */
function computeSegments(gridDays: string[], windows: Record<WindowKey, DateRange>): BandSegment[] {
  const weeks: string[][] = []
  for (let index = 0; index < gridDays.length; index += 7) weeks.push(gridDays.slice(index, index + 7))

  const result: BandSegment[] = []
  for (const windowKey of WINDOW_KEYS) {
    const range = windows[windowKey]
    const forWindow: BandSegment[] = []
    weeks.forEach((week, weekIndex) => {
      const columns = week
        .map((iso, columnIndex) => ({ iso, columnIndex }))
        .filter((entry) => isWithin(entry.iso, range.start, range.end))
      const first = columns[0]
      const last = columns[columns.length - 1]
      if (!first || !last) return
      forWindow.push({
        id: `${windowKey}-${weekIndex}`,
        windowKey,
        weekIndex,
        startColumn: first.columnIndex,
        endColumn: last.columnIndex,
        isFirstSegment: false,
        isLastSegment: false,
      })
    })
    forWindow.forEach((segment, index) => {
      result.push({
        ...segment,
        isFirstSegment: index === 0,
        isLastSegment: index === forWindow.length - 1,
      })
    })
  }
  return result
}

function BandSegmentView({
  segment,
  range,
  draggingId,
  gridDays,
  context,
}: {
  segment: BandSegment
  range: DateRange
  draggingId: string | null
  gridDays: string[]
  context: HolidayContext
}) {
  const colour = segment.windowKey === 'one' ? 'bg-window-one' : 'bg-window-two'
  const label = segment.windowKey === 'one' ? 'Window 1' : 'Window 2'
  const text = `${label}: ${range.start} to ${range.end}`
  const columnCount = segment.endColumn - segment.startColumn + 1

  const days = Array.from({ length: columnCount }, (_, index) => {
    const columnIndex = segment.startColumn + index
    const iso = gridDays[segment.weekIndex * 7 + columnIndex]
    const status = iso ? resolveDayStatus(iso, context) : null
    const isOff = status?.kind === 'weekly-off' || status?.kind === 'holiday'
    return { iso, isOff }
  })

  return (
    <div
      className="relative"
      style={{
        gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
        gridRow: segment.weekIndex + 1,
      }}
    >
      <WindowBody
        id={`${segment.windowKey}-body`}
        text={text}
        colour={colour}
        dragging={draggingId === `${segment.windowKey}-body`}
        days={days}
      />

      {segment.isFirstSegment ? (
        <WindowHandle
          id={`${segment.windowKey}-start`}
          label={`Move the start of ${label}`}
          colour={colour}
          side="left"
          dragging={draggingId === `${segment.windowKey}-start`}
        />
      ) : null}
      {segment.isLastSegment ? (
        <WindowHandle
          id={`${segment.windowKey}-end`}
          label={`Move the end of ${label}`}
          colour={colour}
          side="right"
          dragging={draggingId === `${segment.windowKey}-end`}
        />
      ) : null}
    </div>
  )
}

function WindowBody({
  id,
  text,
  colour,
  dragging,
  days,
}: {
  id: string
  text: string
  colour: string
  dragging: boolean
  days: { iso?: string; isOff: boolean }[]
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          role="button"
          tabIndex={-1}
          aria-label={`${text}. Drag to shift this window.`}
          className={cn(
            'pointer-events-auto absolute inset-x-0 top-0 z-10 grid h-2 cursor-ew-resize touch-none gap-1',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            dragging && 'opacity-80',
          )}
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            transform: CSS.Translate.toString(transform),
          }}
        >
          {days.map((day, index) => (
            <span
              key={index}
              className={cn(
                'h-full rounded-full transition-colors',
                colour,
                day.isOff && 'window-band-muted',
                dragging && 'ring-2 ring-foreground',
              )}
            />
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{text}</p>
        <p className="text-xs opacity-70">Drag the middle to shift the whole window.</p>
      </TooltipContent>
    </Tooltip>
  )
}

function WindowHandle({
  id,
  label,
  colour,
  side,
  dragging,
}: {
  id: string
  label: string
  colour: string
  side: 'left' | 'right'
  dragging: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          role="button"
          tabIndex={0}
          aria-label={label}
          className={cn(
            'pointer-events-auto absolute top-0 z-20 flex h-5 w-4 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-sm',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            dragging && 'ring-2 ring-foreground',
          )}
          style={{ [side]: '-2px', transform: CSS.Translate.toString(transform) }}
        >
          <span className={cn('h-4 w-1.5 rounded-full ring-1 ring-background', colour)} />
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {DAY_LEGEND.map((entry) => (
        <span key={entry.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span aria-hidden className={cn('inline-block size-3.5 rounded-sm border', entry.swatch)} />
          {entry.label}
        </span>
      ))}
    </div>
  )
}

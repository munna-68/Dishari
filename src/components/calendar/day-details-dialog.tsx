import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  Check,
  MapPin,
  RotateCcw,
  User,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatRangeText } from '@/lib/date-format'
import {
  compareIso,
  dateInputValue,
  fromIso,
  isWithin,
  longDateLabel,
} from '@/lib/date'
import type { DateRange } from '@/lib/date-format'
import { printableOfficers } from '@/lib/document-model'
import { getAssignmentsForDay, type OfficerDayAssignment } from '@/lib/schedule-ops'
import type { AppSettings, MonthSchedule, WindowKey } from '@/lib/schema'
import { cn } from '@/lib/utils'
import type { HolidayContext } from '@/lib/working-days'
import { holidayLabel, isToday, isWorkingDay, resolveDayStatus } from '@/lib/working-days'

const QUICK_BRANCHES = ['Issue-Based Monitoring', 'Special Visit at']

export interface DayDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  iso: string | null
  focusedOfficerId?: string | null
  schedule: MonthSchedule
  settings: AppSettings
  context: HolidayContext
  onSetBranch: (officerId: string, windowKey: WindowKey, branch: string) => void
  onSetCustomRanges: (officerId: string, windowKey: WindowKey, ranges: DateRange[]) => void
  onSwapBranches?: (windowKey: WindowKey, fromId: string, toId: string) => void
  onFollowWindow?: (officerId: string, windowKey: WindowKey) => void
  onToggleDay: (iso: string) => void
}

function officerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function DayDetailsDialog({
  open,
  onOpenChange,
  iso,
  focusedOfficerId,
  schedule,
  settings,
  context,
  onSetBranch,
  onSetCustomRanges,
  onSwapBranches,
  onFollowWindow,
  onToggleDay,
}: DayDetailsDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')

  if (!iso) return null

  const parsedDate = fromIso(iso)
  const formattedDayTitle = parsedDate
    ? new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(parsedDate)
    : iso

  const status = resolveDayStatus(iso, context)
  const holiday = holidayLabel(status)
  const bengaliHoliday = status.kind === 'holiday' ? status.holiday.nameBn?.trim() || null : null
  const dayIsToday = isToday(iso)
  const inWindowOne = isWithin(iso, schedule.windows.one.start, schedule.windows.one.end)
  const inWindowTwo = isWithin(iso, schedule.windows.two.start, schedule.windows.two.end)

  const assignments = useMemo(() => {
    return getAssignmentsForDay(iso, schedule)
  }, [iso, schedule])

  const allActiveOfficers = useMemo(() => printableOfficers(schedule), [schedule])

  // Officers not assigned on this date
  const assignedOfficerIds = useMemo(() => new Set(assignments.map((a) => a.officer.id)), [assignments])
  const unassignedOfficers = useMemo(
    () => allActiveOfficers.filter((o) => !assignedOfficerIds.has(o.id)),
    [allActiveOfficers, assignedOfficerIds],
  )

  // Sort assignments: if a specific officer was clicked, put them first
  const sortedAssignments = useMemo(() => {
    let list = [...assignments]
    if (focusedOfficerId) {
      list = list.sort((a, b) => {
        if (a.officer.id === focusedOfficerId) return -1
        if (b.officer.id === focusedOfficerId) return 1
        return 0
      })
    }
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase()
      list = list.filter(
        (a) =>
          a.officer.name.toLowerCase().includes(q) ||
          a.branch.toLowerCase().includes(q) ||
          (a.note && a.note.toLowerCase().includes(q)),
      )
    }
    return list
  }, [assignments, focusedOfficerId, searchTerm])

  function handleAssignUnassignedOfficer(officerId: string) {
    // Determine which window makes sense:
    // If inside window two, assign to two; otherwise default to one
    const windowKey: WindowKey = inWindowTwo && !inWindowOne ? 'two' : 'one'
    // If date is outside the window, set customRanges covering this date
    const windowRange = schedule.windows[windowKey]
    if (!isWithin(iso, windowRange.start, windowRange.end)) {
      onSetCustomRanges(officerId, windowKey, [{ start: iso, end: iso }])
    } else {
      // If within window, following window will include this date
      onSetCustomRanges(officerId, windowKey, [])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        {/* Header */}
        <DialogHeader className="border-b px-5 pt-5 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              {formattedDayTitle}
            </DialogTitle>
            {dayIsToday ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs font-semibold uppercase">
                Today
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {/* Status badge */}
            {status.kind === 'working' ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                Working day
              </Badge>
            ) : null}
            {status.kind === 'holiday' ? (
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300">
                Holiday: {holiday}
                {bengaliHoliday ? ` (${bengaliHoliday})` : ''}
              </Badge>
            ) : null}
            {status.kind === 'weekly-off' ? (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                Weekly off day
              </Badge>
            ) : null}
            {status.kind === 'override' ? (
              <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300">
                Working-day override
              </Badge>
            ) : null}

            {/* Window badge */}
            {inWindowOne ? (
              <Badge variant="outline" className="border-window-one/40 bg-window-one/15 text-window-one">
                Window 1 ({schedule.windows.one.start} – {schedule.windows.one.end})
              </Badge>
            ) : null}
            {inWindowTwo ? (
              <Badge variant="outline" className="border-window-two/40 bg-window-two/15 text-window-two">
                Window 2 ({schedule.windows.two.start} – {schedule.windows.two.end})
              </Badge>
            ) : null}
            {!inWindowOne && !inWindowTwo ? (
              <span className="text-muted-foreground">Outside main visit windows</span>
            ) : null}
          </div>

          <DialogDescription className="sr-only">
            Details and assignments for {formattedDayTitle}
          </DialogDescription>
        </DialogHeader>

        {/* Day Status Control Bar */}
        <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-5 py-2 text-xs">
          <div className="text-muted-foreground">
            {status.kind === 'holiday'
              ? status.holiday.source === 'imported'
                ? 'Government declared holiday.'
                : 'Marked as manual holiday.'
              : status.kind === 'weekly-off'
                ? 'Weekly regular off day.'
                : status.kind === 'override'
                  ? 'Overridden to count as a working day.'
                  : 'Regular working day for monitoring visits.'}
          </div>
          <div>
            {status.kind === 'working' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onToggleDay(iso)}
              >
                <CalendarOff className="mr-1.5 size-3.5 text-holiday" />
                Mark as Holiday
              </Button>
            ) : null}
            {status.kind === 'holiday' && status.holiday.source === 'manual' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onToggleDay(iso)}
              >
                <CalendarCheck className="mr-1.5 size-3.5 text-emerald-600" />
                Remove Holiday
              </Button>
            ) : null}
            {status.kind === 'holiday' && status.holiday.source === 'imported' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onToggleDay(iso)}
              >
                <CalendarCheck className="mr-1.5 size-3.5 text-emerald-600" />
                Work on this Holiday (Override)
              </Button>
            ) : null}
            {status.kind === 'weekly-off' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onToggleDay(iso)}
              >
                <CalendarCheck className="mr-1.5 size-3.5 text-sky-600" />
                Override as Working Day
              </Button>
            ) : null}
            {status.kind === 'override' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onToggleDay(iso)}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Reset to Off Day
              </Button>
            ) : null}
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Section: Officers & Branches */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Officer Assignments ({assignments.length})
                </h3>
              </div>

              {assignments.length > 3 ? (
                <div className="w-48">
                  <Input
                    type="search"
                    placeholder="Search officer / branch..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              ) : null}
            </div>

            {assignments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 size-6 opacity-40" />
                <p className="font-medium">No officers scheduled for this date.</p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Visits happen during Window 1 ({schedule.windows.one.start} to {schedule.windows.one.end}) or Window 2 ({schedule.windows.two.start} to {schedule.windows.two.end}).
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortedAssignments.map((assignment) => (
                  <AssignmentEditCard
                    key={`${assignment.officer.id}-${assignment.windowKey}`}
                    assignment={assignment}
                    isFocused={assignment.officer.id === focusedOfficerId}
                    allOfficersInWindow={allActiveOfficers}
                    rememberedBranches={settings.recentBranchNames}
                    context={context}
                    windowRange={schedule.windows[assignment.windowKey]}
                    onSetBranch={(branch) => onSetBranch(assignment.officer.id, assignment.windowKey, branch)}
                    onSetCustomRanges={(ranges) => onSetCustomRanges(assignment.officer.id, assignment.windowKey, ranges)}
                    onFollowWindow={() => onFollowWindow?.(assignment.officer.id, assignment.windowKey)}
                    onSwapBranches={(targetOfficerId) =>
                      onSwapBranches?.(assignment.windowKey, assignment.officer.id, targetOfficerId)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section: Assign another officer */}
          {unassignedOfficers.length > 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-foreground">Assign another officer to this date</p>
                  <p className="text-[11px] text-muted-foreground">
                    {unassignedOfficers.length} officer{unassignedOfficers.length === 1 ? '' : 's'} not scheduled on this day
                  </p>
                </div>
                <div className="w-56">
                  <Select onValueChange={handleAssignUnassignedOfficer}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="+ Schedule an officer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedOfficers.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">
                          {o.name} {o.kind === 'temporary' ? '(Temp)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t bg-muted/20 px-5 py-3 flex-row items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Changes update the schedule and export tables immediately.
          </p>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssignmentEditCard({
  assignment,
  isFocused,
  allOfficersInWindow,
  rememberedBranches,
  context,
  windowRange,
  onSetBranch,
  onSetCustomRanges,
  onFollowWindow,
  onSwapBranches,
}: {
  assignment: OfficerDayAssignment
  isFocused: boolean
  allOfficersInWindow: MonthSchedule['officers']
  rememberedBranches: string[]
  context: HolidayContext
  windowRange: DateRange
  onSetBranch: (branch: string) => void
  onSetCustomRanges: (ranges: DateRange[]) => void
  onFollowWindow: () => void
  onSwapBranches: (targetOfficerId: string) => void
}) {
  const [branchDraft, setBranchDraft] = useState(assignment.branch)
  const [editingDates, setEditingDates] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)

  // Keep draft in sync if external assignment changes
  if (assignment.branch !== branchDraft && document.activeElement?.id !== `branch-input-${assignment.officer.id}`) {
    setBranchDraft(assignment.branch)
  }

  const rangeSummary = useMemo(() => {
    return formatRangeText(assignment.ranges, { splitAroundHolidays: false, context })
  }, [assignment.ranges, context])

  const otherOfficers = useMemo(
    () => allOfficersInWindow.filter((o) => o.id !== assignment.officer.id && !o.crossedOut),
    [allOfficersInWindow, assignment.officer.id],
  )

  const quickSuggestions = useMemo(() => {
    const list: string[] = []
    const seen = new Set<string>()
    for (const b of [...QUICK_BRANCHES, ...rememberedBranches.slice(0, 4)]) {
      const key = b.trim().toLowerCase()
      if (key && !seen.has(key) && key !== assignment.branch.trim().toLowerCase()) {
        seen.add(key)
        list.push(b)
      }
    }
    return list.slice(0, 4)
  }, [rememberedBranches, assignment.branch])

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors space-y-2.5',
        isFocused ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : 'bg-card',
      )}
    >
      {/* Officer Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
            {officerInitials(assignment.officer.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {assignment.officer.name}
              </span>
              {assignment.officer.kind === 'temporary' ? (
                <Badge variant="outline" className="px-1 py-0 text-[10px]">
                  Temp
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              'px-1.5 py-0.5 text-[11px] font-medium',
              assignment.windowKey === 'one'
                ? 'border-window-one/40 bg-window-one/15 text-window-one'
                : 'border-window-two/40 bg-window-two/15 text-window-two',
            )}
          >
            {assignment.windowKey === 'one' ? 'Window 1' : 'Window 2'}
          </Badge>

          {/* Swap branch menu */}
          {otherOfficers.length > 0 ? (
            <Popover open={swapOpen} onOpenChange={setSwapOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  title="Swap branch with another officer"
                >
                  <ArrowLeftRight className="size-3" />
                  <span className="sr-only">Swap branch</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 text-xs" align="end">
                <p className="font-medium mb-1.5">Swap branch with:</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {otherOfficers.map((other) => (
                    <button
                      key={other.id}
                      type="button"
                      onClick={() => {
                        onSwapBranches(other.id)
                        setSwapOpen(false)
                      }}
                      className="w-full text-left rounded px-2 py-1 hover:bg-accent truncate text-xs"
                    >
                      {other.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      {/* Branch field */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <Label
            htmlFor={`branch-input-${assignment.officer.id}`}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
          >
            <MapPin className="size-3" />
            Branch / Location
          </Label>
          {assignment.branch.trim() ? (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
              <Check className="size-2.5" /> Assigned
            </span>
          ) : (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Not assigned yet
            </span>
          )}
        </div>

        <Input
          id={`branch-input-${assignment.officer.id}`}
          type="text"
          value={branchDraft}
          placeholder="Enter branch name (e.g. Lalmonirhat)"
          onChange={(e) => {
            setBranchDraft(e.target.value)
            onSetBranch(e.target.value)
          }}
          className="h-8 text-xs bg-background"
        />

        {quickSuggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <span className="text-[10px] text-muted-foreground mr-0.5">Quick:</span>
            {quickSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  const next = branchDraft.trim() === '' ? suggestion : `${branchDraft.trim()} ${suggestion}`
                  setBranchDraft(next)
                  onSetBranch(next)
                }}
                className="rounded-full border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Schedule row */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t text-xs">
        <div className="text-[11px] text-muted-foreground">
          <span>Schedule: </span>
          <span className="font-medium text-foreground">{rangeSummary}</span>
          <span className="text-[10px] opacity-70 ml-1">
            {assignment.isCustomRange ? '(custom)' : '(window)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {assignment.isCustomRange ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={onFollowWindow}
            >
              Reset to window
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setEditingDates((current) => !current)}
          >
            {editingDates ? 'Hide dates' : 'Edit dates'}
          </Button>
        </div>
      </div>

      {/* Inline custom dates editor */}
      {editingDates ? (
        <div className="rounded-md border bg-muted/20 p-2.5 text-xs space-y-2">
          <p className="font-medium text-[11px]">Set custom visit dates:</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Start date</Label>
              <Input
                type="date"
                value={dateInputValue(assignment.ranges[0]?.start ?? windowRange.start)}
                onChange={(e) => {
                  const currentEnd = assignment.ranges[0]?.end ?? windowRange.end
                  const newStart = e.target.value
                  if (newStart) {
                    onSetCustomRanges([{ start: newStart, end: compareIso(newStart, currentEnd) > 0 ? newStart : currentEnd }])
                  }
                }}
                className="h-7 text-xs bg-background"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">End date</Label>
              <Input
                type="date"
                value={dateInputValue(assignment.ranges[0]?.end ?? windowRange.end)}
                onChange={(e) => {
                  const currentStart = assignment.ranges[0]?.start ?? windowRange.start
                  const newEnd = e.target.value
                  if (newEnd) {
                    onSetCustomRanges([{ start: compareIso(currentStart, newEnd) > 0 ? newEnd : currentStart, end: newEnd }])
                  }
                }}
                className="h-7 text-xs bg-background"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

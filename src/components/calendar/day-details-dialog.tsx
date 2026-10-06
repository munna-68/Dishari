import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  RotateCcw,
  Sparkles,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRangeText } from '@/lib/date-format'
import {
  addDays,
  compareIso,
  dateInputValue,
  fromIso,
  isWithin,
} from '@/lib/date'
import type { DateRange } from '@/lib/date-format'
import { printableOfficers } from '@/lib/document-model'
import { getAssignmentsForDay, type OfficerDayAssignment } from '@/lib/schedule-ops'
import type { AppSettings, MonthSchedule, WindowKey } from '@/lib/schema'
import { cn } from '@/lib/utils'
import type { HolidayContext } from '@/lib/working-days'
import { holidayLabel, isToday, resolveDayStatus } from '@/lib/working-days'

const QUICK_BRANCHES = ['Issue-Based Monitoring', 'Special Visit at']

export interface DayDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  iso: string | null
  focusedOfficerId?: string | null
  schedule: MonthSchedule
  settings: AppSettings
  context: HolidayContext
  onNavigateDate?: (nextIso: string) => void
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
  onNavigateDate,
  onSetBranch,
  onSetCustomRanges,
  onSwapBranches,
  onFollowWindow,
  onToggleDay,
}: DayDetailsDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'officers' | 'activities'>('officers')

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

  // Sort assignments: if a specific officer was focused, put them first
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

  const assignedBranchesCount = assignments.filter((a) => a.branch.trim() !== '').length

  function handleAssignUnassignedOfficer(officerId: string) {
    if (!iso) return
    const targetIso: string = iso
    const windowKey: WindowKey = inWindowTwo && !inWindowOne ? 'two' : 'one'
    const windowRange = schedule.windows[windowKey]
    if (!isWithin(targetIso, windowRange.start, windowRange.end)) {
      onSetCustomRanges(officerId, windowKey, [{ start: targetIso, end: targetIso }])
    } else {
      onSetCustomRanges(officerId, windowKey, [])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-full sm:max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        {/* Header with Day Navigation (< and >) */}
        <DialogHeader className="border-b px-5 pt-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {onNavigateDate ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-md"
                  onClick={() => onNavigateDate(addDays(iso, -1))}
                  title="Previous day"
                >
                  <ChevronLeft className="size-4" />
                  <span className="sr-only">Previous day</span>
                </Button>
              ) : null}

              <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                {formattedDayTitle}
              </DialogTitle>

              {onNavigateDate ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-md"
                  onClick={() => onNavigateDate(addDays(iso, 1))}
                  title="Next day"
                >
                  <ChevronRight className="size-4" />
                  <span className="sr-only">Next day</span>
                </Button>
              ) : null}

              {dayIsToday ? (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-semibold uppercase">
                  Today
                </Badge>
              ) : null}
            </div>

            <DialogDescription className="sr-only">
              Schedule details, officers, branches, and activities for {formattedDayTitle}
            </DialogDescription>
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
        </DialogHeader>

        {/* Day Status Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-5 py-2.5 text-xs">
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

        {/* Tabbed view: Officers & Branches vs Monitoring Activities */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'officers' | 'activities')}
          className="flex flex-1 flex-col overflow-hidden min-h-0"
        >
          <div className="border-b px-5 pt-2 bg-muted/10 flex items-center justify-between">
            <TabsList className="h-8">
              <TabsTrigger
                value="officers"
                onClick={() => setActiveTab('officers')}
                className="text-xs h-7 px-3 gap-1.5"
              >
                <Users className="size-3.5" />
                Officers & Branches ({assignments.length})
              </TabsTrigger>
              <TabsTrigger
                value="activities"
                onClick={() => setActiveTab('activities')}
                className="text-xs h-7 px-3 gap-1.5"
              >
                <ListTodo className="size-3.5" />
                Monitoring Tasks ({schedule.activities.length})
              </TabsTrigger>
            </TabsList>

            {assignments.length > 0 && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {assignedBranchesCount} of {assignments.length} branches assigned
              </span>
            )}
          </div>

          {/* Officers Tab */}
          <TabsContent value="officers" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 mt-0 min-h-0">
            {assignments.length > 4 ? (
              <div className="flex items-center justify-between gap-2 pb-1">
                <p className="text-xs text-muted-foreground">
                  View and update branch assignments for {formattedDayTitle}:
                </p>
                <div className="w-56">
                  <Input
                    type="search"
                    placeholder="Search officer or branch..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-7 text-xs bg-background"
                  />
                </div>
              </div>
            ) : null}

            {assignments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 size-7 opacity-40" />
                <p className="font-medium text-foreground">No officers scheduled for this date.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Visits happen during Window 1 ({schedule.windows.one.start} to {schedule.windows.one.end}) or Window 2 ({schedule.windows.two.start} to {schedule.windows.two.end}).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedAssignments.map((assignment) => (
                  <OfficerAssignmentRow
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

            {/* Assign an unassigned officer section */}
            {unassignedOfficers.length > 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/15 p-3 mt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">Schedule another officer for this date</p>
                    <p className="text-[11px] text-muted-foreground">
                      {unassignedOfficers.length} officer{unassignedOfficers.length === 1 ? '' : 's'} not scheduled on this day
                    </p>
                  </div>
                  <div className="w-56">
                    <Select onValueChange={handleAssignUnassignedOfficer}>
                      <SelectTrigger className="h-7 text-xs bg-background">
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
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="flex-1 overflow-y-auto p-4 sm:p-5 mt-0 space-y-3 min-h-0">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Monthly Monitoring Tasks</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                The responsible officers carry out these tasks during their branch monitoring visits:
              </p>
            </div>

            <div className="space-y-2">
              {schedule.activities.map((act, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg border bg-card p-3 text-xs shadow-2xs"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-foreground leading-relaxed font-normal pt-0.5">{act}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="border-t bg-muted/20 px-5 py-3 flex-row items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Changes update the schedule, table, and exports automatically.
          </p>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OfficerAssignmentRow({
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
  const [editingDates, setEditingDates] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  const rangeSummary = useMemo(() => {
    return formatRangeText(assignment.ranges, { splitAroundHolidays: false, context })
  }, [assignment.ranges, context])

  const otherOfficers = useMemo(
    () => allOfficersInWindow.filter((o) => o.id !== assignment.officer.id && !o.crossedOut),
    [allOfficersInWindow, assignment.officer.id],
  )

  const suggestions = useMemo(() => {
    const list: string[] = []
    const seen = new Set<string>()
    for (const b of [...QUICK_BRANCHES, ...rememberedBranches.slice(0, 8)]) {
      const key = b.trim().toLowerCase()
      if (key && !seen.has(key) && key !== assignment.branch.trim().toLowerCase()) {
        seen.add(key)
        list.push(b)
      }
    }
    return list
  }, [rememberedBranches, assignment.branch])

  return (
    <div
      className={cn(
        'rounded-lg border p-3 bg-card transition-colors space-y-2',
        isFocused ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : 'hover:border-border',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Officer name & window */}
        <div className="flex items-center gap-2.5 min-w-[210px]">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
            {officerInitials(assignment.officer.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground truncate">
                {assignment.officer.name}
              </span>
              {assignment.officer.kind === 'temporary' ? (
                <Badge variant="outline" className="px-1 py-0 text-[9px]">
                  Temp
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Badge
                variant="outline"
                className={cn(
                  'px-1 py-0 text-[10px] font-medium border-0',
                  assignment.windowKey === 'one'
                    ? 'bg-window-one/15 text-window-one'
                    : 'bg-window-two/15 text-window-two',
                )}
              >
                {assignment.windowKey === 'one' ? 'Window 1' : 'Window 2'}
              </Badge>
              <span>·</span>
              <span className="truncate">{rangeSummary}</span>
            </div>
          </div>
        </div>

        {/* Branch input with datalist and quick tools */}
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                id={`branch-input-${assignment.officer.id}`}
                list={`branch-list-${assignment.officer.id}`}
                type="text"
                value={assignment.branch}
                placeholder="Branch name (e.g. Lalmonirhat)"
                onChange={(e) => onSetBranch(e.target.value)}
                className="h-8 w-full rounded-md border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <datalist id={`branch-list-${assignment.officer.id}`}>
                {rememberedBranches.map((b) => (
                  <option key={b} value={b} />
                ))}
                {QUICK_BRANCHES.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            {/* Quick suggestions popover button */}
            {suggestions.length > 0 ? (
              <Popover open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1"
                    title="Quick branch suggestions"
                  >
                    <Sparkles className="size-3 text-primary" />
                    <span className="hidden md:inline text-[11px]">Suggestions</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 text-xs" align="end">
                  <p className="font-semibold text-xs mb-1.5 text-foreground">Quick Branch Options:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          const current = assignment.branch.trim()
                          const next = current ? `${current} ${s}` : s
                          onSetBranch(next)
                          setSuggestionsOpen(false)
                        }}
                        className="w-full text-left rounded px-2 py-1 hover:bg-accent text-xs truncate"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}

            {/* Swap branch popover */}
            {otherOfficers.length > 0 ? (
              <Popover open={swapOpen} onOpenChange={setSwapOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Swap branch with another officer in this window"
                  >
                    <ArrowLeftRight className="size-3.5" />
                    <span className="sr-only">Swap</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 text-xs" align="end">
                  <p className="font-semibold text-xs mb-1.5 text-foreground">Swap branch with:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {otherOfficers.map((other) => (
                      <button
                        key={other.id}
                        type="button"
                        onClick={() => {
                          onSwapBranches(other.id)
                          setSwapOpen(false)
                        }}
                        className="w-full text-left rounded px-2 py-1 hover:bg-accent text-xs truncate"
                      >
                        {other.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}

            {/* Edit dates toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setEditingDates((current) => !current)}
            >
              {editingDates ? 'Close' : 'Dates'}
            </Button>
          </div>
        </div>
      </div>

      {/* Inline custom dates editor when toggled */}
      {editingDates ? (
        <div className="rounded-md border bg-muted/20 p-2.5 text-xs space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <p className="font-medium text-[11px] text-foreground">
              {assignment.isCustomRange ? 'Custom visit dates:' : 'Currently follows window dates:'}
            </p>
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
          </div>
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

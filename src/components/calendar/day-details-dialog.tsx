import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  RotateCcw,
  Users,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

  const allKnownBranches = useMemo(() => {
    const set = new Set<string>()
    for (const b of settings.recentBranchNames) {
      if (b.trim()) set.add(b.trim())
    }
    for (const offId of Object.keys(schedule.assignments)) {
      for (const win of ['one', 'two'] as const) {
        const b = schedule.assignments[offId]?.[win]?.branch?.trim()
        if (b) set.add(b)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [settings.recentBranchNames, schedule.assignments])

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
    return list
  }, [assignments, focusedOfficerId])

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
      <DialogContent showCloseButton={false} className="flex h-[85vh] max-h-[760px] w-full sm:max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        {/* Header with Day Navigation (< and >) and Done action */}
        <DialogHeader className="border-b px-5 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
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

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="h-8 px-3.5 text-xs font-semibold shadow-2xs"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
                title="Close dialog"
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
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
          <TabsContent
            value="officers"
            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 mt-0 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:duration-200"
          >
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
                    allBranches={allKnownBranches}
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
          <TabsContent
            value="activities"
            className="flex-1 overflow-y-auto p-4 sm:p-5 mt-0 space-y-3 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:duration-200"
          >
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
      </DialogContent>
    </Dialog>
  )
}

function BranchCombobox({
  value,
  onChange,
  allBranches,
}: {
  value: string
  onChange: (val: string) => void
  allBranches: string[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allBranches
    return allBranches.filter((b) => b.toLowerCase().includes(q))
  }, [allBranches, search])

  function handleSelect(branchName: string) {
    onChange(branchName)
    setOpen(false)
    setSearch('')
  }

  function handleQuickAction(action: string) {
    if (action === 'Issue-Based Monitoring') {
      onChange('Issue-Based Monitoring')
    } else if (action === 'Special Visit at') {
      const current = value.trim()
      onChange(current ? `${current} (Special Visit)` : 'Special Visit at ')
    }
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative flex-1 min-w-[200px]">
        <Input
          type="text"
          value={value}
          placeholder="Branch name (e.g. Lalmonirhat)"
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full pr-7 text-xs bg-background"
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-6 rounded text-muted-foreground hover:text-foreground"
            title="Browse branch options"
          >
            <ChevronDown className={cn('size-3.5 transition-transform duration-150', open && 'rotate-180')} />
            <span className="sr-only">Toggle branch options</span>
          </Button>
        </PopoverTrigger>
      </div>

      <PopoverContent
        className="w-[280px] p-2 text-xs shadow-md"
        align="start"
        sideOffset={4}
      >
        <div className="space-y-2">
          {allBranches.length > 5 ? (
            <div className="px-0.5">
              <Input
                type="search"
                placeholder="Filter branches..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs bg-muted/40"
                autoFocus
              />
            </div>
          ) : null}

          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
            <div className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {allBranches.length > 0 ? 'Available Branches' : 'No saved branches'}
            </div>

            {filteredBranches.map((branch) => {
              const isSelected = value.trim().toLowerCase() === branch.trim().toLowerCase()
              return (
                <button
                  key={branch}
                  type="button"
                  onClick={() => handleSelect(branch)}
                  className={cn(
                    'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent text-foreground',
                  )}
                >
                  <span className="truncate">{branch}</span>
                  {isSelected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                </button>
              )
            })}

            {filteredBranches.length === 0 && allBranches.length > 0 ? (
              <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                No matching branch found
              </p>
            ) : null}
          </div>

          <div className="border-t pt-1.5 space-y-1">
            <div className="px-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Quick Actions
            </div>
            <div className="flex flex-wrap items-center gap-1 px-1">
              {QUICK_BRANCHES.map((qb) => (
                <button
                  key={qb}
                  type="button"
                  onClick={() => handleQuickAction(qb)}
                  className="rounded border bg-muted/40 hover:bg-muted px-2 py-0.5 text-[11px] text-foreground transition-colors"
                >
                  + {qb}
                </button>
              ))}
              {value.trim() !== '' ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                    setSearch('')
                  }}
                  className="rounded border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 px-2 py-0.5 text-[11px] text-destructive transition-colors ml-auto"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function OfficerAssignmentRow({
  assignment,
  isFocused,
  allOfficersInWindow,
  allBranches,
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
  allBranches: string[]
  context: HolidayContext
  windowRange: DateRange
  onSetBranch: (branch: string) => void
  onSetCustomRanges: (ranges: DateRange[]) => void
  onFollowWindow: () => void
  onSwapBranches: (targetOfficerId: string) => void
}) {
  const [editingDates, setEditingDates] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)

  const rangeSummary = useMemo(() => {
    return formatRangeText(assignment.ranges, { splitAroundHolidays: false, context })
  }, [assignment.ranges, context])

  const otherOfficers = useMemo(
    () => allOfficersInWindow.filter((o) => o.id !== assignment.officer.id && !o.crossedOut),
    [allOfficersInWindow, assignment.officer.id],
  )


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

        {/* Branch combobox and tools */}
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-1.5">
            <BranchCombobox
              value={assignment.branch}
              onChange={onSetBranch}
              allBranches={allBranches}
            />

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
              type="button"
              variant={editingDates ? 'secondary' : 'outline'}
              size="sm"
              className={cn(
                'h-8 px-2.5 text-xs font-medium rounded-md gap-1.5 transition-all shrink-0 shadow-2xs',
                editingDates
                  ? 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/20 ring-1 ring-primary/30'
                  : 'bg-background hover:bg-muted text-foreground border-border',
              )}
              onClick={() => setEditingDates((current) => !current)}
              title={editingDates ? 'Hide custom dates' : 'Customize visit dates for this officer'}
            >
              <CalendarDays className={cn('size-3.5', editingDates ? 'text-primary' : 'text-muted-foreground')} />
              <span>Dates</span>
              <ChevronDown className={cn('size-3 transition-transform duration-200', editingDates && 'rotate-180 text-primary')} />
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

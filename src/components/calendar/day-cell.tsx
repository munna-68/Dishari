import { ArrowUpRight } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { OfficerDayAssignment } from '@/lib/schedule-ops'
import { cn } from '@/lib/utils'
import type { DayStatus } from '@/lib/working-days'

export interface DayCellProps {
  iso: string
  date: number
  inMonth: boolean
  status: DayStatus
  /** Full English name, or null when the day carries no holiday. */
  holidayName: string | null
  bengaliName: string | null
  isToday: boolean
  /** Date sits inside one of the two visit windows. */
  inWindowOne: boolean
  inWindowTwo: boolean
  /** Highlighted because the selected officer visits on this date. */
  isOfficerRange: boolean
  assignments?: OfficerDayAssignment[]
  selectedOfficerId?: string | null
  onClick: () => void
}

export function DayCell({
  iso,
  date,
  inMonth,
  status,
  holidayName,
  bengaliName,
  isToday,
  inWindowOne,
  inWindowTwo,
  isOfficerRange,
  assignments = [],
  selectedOfficerId = null,
  onClick,
}: DayCellProps) {
  const isWorking = status.kind === 'working' || status.kind === 'override'
  const isHoliday = status.kind === 'holiday'
  const isOff = status.kind === 'weekly-off'

  const selectedAssignment = selectedOfficerId
    ? assignments.find((a) => a.officer.id === selectedOfficerId)
    : null

  const body = (
    <div
      role="button"
      tabIndex={0}
      data-date={iso}
      aria-label={describeDay(iso, status, holidayName, assignments.length)}
      className={cellClasses(status, inMonth, inWindowOne, inWindowTwo, isOfficerRange, isToday)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Top row: Date number, Today badge, Holiday/Override badge */}
      <div className="flex items-center justify-between gap-1 w-full">
        <span
          className={cn(
            'text-xs font-semibold tabular-nums sm:text-sm',
            isToday &&
              'inline-flex size-5 items-center justify-center rounded-full bg-foreground text-background text-[11px] font-bold',
            !inMonth && 'opacity-50',
          )}
        >
          {date}
        </span>

        {isHoliday && holidayName ? (
          <span className="line-clamp-1 max-w-[75%] rounded bg-holiday/15 px-1 py-0.5 text-[9px] sm:text-[10px] font-medium leading-none text-holiday">
            {holidayName}
          </span>
        ) : null}

        {status.kind === 'override' ? (
          <span className="text-[9px] font-semibold tracking-wider text-window-one uppercase">
            Override
          </span>
        ) : null}
      </div>

      {/* Screen-reader labels */}
      {status.kind === 'weekly-off' ? <span className="sr-only">weekly off day</span> : null}
      {status.kind === 'override' ? <span className="sr-only">working-day override</span> : null}

      {/* Clean cell body with bottom indication */}
      {selectedOfficerId ? (
        // When a specific officer is selected in sidebar/filter
        selectedAssignment ? (
          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium leading-none truncate shadow-2xs',
                selectedAssignment.windowKey === 'one'
                  ? 'bg-window-one/15 text-window-one border border-window-one/30'
                  : 'bg-window-two/15 text-window-two border border-window-two/30',
              )}
              title={`${selectedAssignment.officer.name}: ${selectedAssignment.branch || 'Scheduled'}`}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full shrink-0',
                  selectedAssignment.windowKey === 'one' ? 'bg-window-one' : 'bg-window-two',
                )}
              />
              <span className="truncate">
                {selectedAssignment.branch || selectedAssignment.officer.name}
              </span>
            </span>
            <ArrowUpRight className="size-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
          </div>
        ) : null
      ) : (
        // Team view: Clean empty cell with elegant assignment badge at foot
        isWorking && assignments.length > 0 ? (
          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium leading-none transition-colors shadow-2xs',
                inWindowOne
                  ? 'bg-window-one/15 text-window-one border border-window-one/30'
                  : inWindowTwo
                    ? 'bg-window-two/15 text-window-two border border-window-two/30'
                    : 'bg-muted text-muted-foreground border',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full shrink-0',
                  inWindowOne ? 'bg-window-one' : inWindowTwo ? 'bg-window-two' : 'bg-muted-foreground',
                )}
              />
              <span>{assignments.length} officers</span>
            </span>

            <span className="text-[10px] font-medium text-muted-foreground/0 group-hover/cell:text-muted-foreground transition-all flex items-center gap-0.5 shrink-0">
              <span className="hidden xl:inline">Details</span>
              <ArrowUpRight className="size-3" />
            </span>
          </div>
        ) : isHoliday && assignments.length > 0 ? (
          <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground/70 font-medium">
            <span>{assignments.length} in window</span>
            <ArrowUpRight className="size-3 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
          </div>
        ) : isOff && assignments.some((a) => a.isCustomRange) ? (
          <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground/80 font-medium">
            <span>Custom visit</span>
            <ArrowUpRight className="size-3 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
          </div>
        ) : null
      )}

      {/* Small status dots */}
      {status.kind === 'holiday' && status.holiday.source === 'manual' ? (
        <span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-holiday ring-1 ring-background" />
      ) : null}
      {status.kind === 'override' ? (
        <span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-window-one ring-1 ring-background" />
      ) : null}
      {isToday ? (
        <span className="absolute bottom-1 right-1 text-[8px] font-semibold tracking-wide uppercase opacity-70">
          Today
        </span>
      ) : null}
    </div>
  )

  if (!holidayName && status.kind !== 'override' && assignments.length === 0) return body

  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs max-w-56">
          <p className="font-semibold text-foreground">
            {holidayName ?? (status.kind === 'override' ? 'Working-day override' : (isOff ? 'Weekly off day' : 'Working day'))}
          </p>
          {bengaliName ? <p lang="bn" className="text-muted-foreground">{bengaliName}</p> : null}
          {assignments.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {assignments.length} officer{assignments.length === 1 ? '' : 's'} assigned to branch visits
            </p>
          ) : null}
          <p className="text-[10px] text-primary pt-0.5 font-medium flex items-center gap-1">
            <span>Click to expand details</span>
            <ArrowUpRight className="size-3" />
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function cellClasses(
  status: DayStatus,
  inMonth: boolean,
  inWindowOne: boolean,
  inWindowTwo: boolean,
  isOfficerRange: boolean,
  isToday: boolean,
): string {
  return cn(
    'group/cell relative flex h-full min-h-18 sm:min-h-20 flex-col gap-0.5 overflow-hidden rounded-md border p-1 text-left transition-all cursor-pointer select-none',
    'hover:border-primary/70 hover:shadow-2xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    isToday && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
    status.kind === 'holiday'
      ? 'border-holiday bg-holiday-soft'
      : status.kind === 'override'
        ? 'border-window-one/60 bg-window-one-soft'
        : status.kind === 'weekly-off'
          ? inWindowOne
            ? 'bg-window-one-muted-off text-muted-foreground'
            : inWindowTwo
              ? 'bg-window-two-muted-off text-muted-foreground'
              : 'bg-weekend text-muted-foreground'
          : inWindowOne
            ? 'bg-window-one-soft/50'
            : inWindowTwo
              ? 'bg-window-two-soft/50'
              : inMonth
                ? 'bg-card'
                : 'bg-muted/40',
    status.kind === 'weekly-off' && 'offday-hatch',
    !inMonth && 'opacity-60',
    isOfficerRange && 'outline-primary/40 outline-2 outline-offset-[-2px]',
  )
}

function describeDay(
  iso: string,
  status: DayStatus,
  holidayName: string | null,
  assignedCount: number,
): string {
  const countText = assignedCount > 0 ? `, ${assignedCount} officer(s) assigned` : ''
  if (holidayName) return `${iso}: ${holidayName}${countText}. Click to expand information.`
  switch (status.kind) {
    case 'weekly-off':
      return `${iso}: weekly off day${countText}. Click to expand information.`
    case 'override':
      return `${iso}: working-day override${countText}. Click to expand information.`
    default:
      return `${iso}: working day${countText}. Click to expand information.`
  }
}

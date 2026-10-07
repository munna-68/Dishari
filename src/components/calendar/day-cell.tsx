import { ArrowUpRight, User } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fromIso } from '@/lib/date'
import { getOfficerColor } from '@/lib/officer-colors'
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
      aria-label={describeDay(iso, status, holidayName, bengaliName, assignments.length)}
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
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              'text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100',
              !inMonth && 'font-normal text-slate-400 dark:text-slate-500 opacity-60',
            )}
          >
            {date}
          </span>
          {isToday ? (
            <div className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-blue-500 shrink-0" />
              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase leading-none shadow-2xs">
                Today
              </span>
            </div>
          ) : null}
        </div>

        {isHoliday && holidayName ? (
          <span className="line-clamp-1 max-w-[65%] rounded-md bg-holiday/15 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium leading-none text-holiday">
            {holidayName}
          </span>
        ) : null}

        {status.kind === 'override' ? (
          <span className="text-[9px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
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
        selectedAssignment ? (() => {
          const oColor = getOfficerColor(selectedAssignment.officer)
          return (
            <div className="mt-auto flex items-center justify-between gap-1 pt-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium leading-none truncate shadow-2xs border',
                  oColor.badgeBg,
                  oColor.badgeText,
                  oColor.badgeBorder,
                )}
                title={`${selectedAssignment.officer.name}: ${selectedAssignment.branch || 'Scheduled'}`}
              >
                <User className="size-3 shrink-0" />
                <span className="truncate">
                  {selectedAssignment.branch || selectedAssignment.officer.name}
                </span>
              </span>
            </div>
          )
        })() : null
      ) : (
        // Team view: Clean cell with pill badge at foot
        isWorking && assignments.length > 0 ? (
          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium leading-none transition-colors shadow-2xs',
                inWindowOne
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                  : inWindowTwo
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60',
              )}
            >
              <User className="size-3 shrink-0" />
              <span>{assignments.length} officers</span>
            </span>
          </div>
        ) : isHoliday && assignments.length > 0 ? (
          <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground/70 font-medium">
            <span>{assignments.length} in window</span>
          </div>
        ) : isOff && assignments.some((a) => a.isCustomRange) ? (
          <div className="mt-auto flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="size-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>Customs visit</span>
          </div>
        ) : null
      )}

      {/* Small status dots */}
      {status.kind === 'holiday' && status.holiday.source === 'manual' ? (
        <span className="absolute right-2 bottom-2 size-2 rounded-full bg-orange-500 ring-1 ring-background" />
      ) : null}
      {status.kind === 'override' ? (
        <span className="absolute right-2 bottom-2 size-2 rounded-full bg-emerald-500 ring-1 ring-background" />
      ) : null}
    </div>
  )

  const parsedDate = fromIso(iso)
  const dayFullTitle = parsedDate
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(parsedDate)
    : iso

  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className={cn(
          'z-50 max-w-64 rounded-xl border p-3 shadow-lg select-none',
          'bg-popover text-popover-foreground border-border/80',
          inWindowOne && 'border-window-one/40 ring-1 ring-window-one/20',
          inWindowTwo && 'border-window-two/40 ring-1 ring-window-two/20',
        )}
      >
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">
              {dayFullTitle}
            </span>
            {inWindowOne ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-window-one/15 text-window-one border border-window-one/30">
                Window 1
              </span>
            ) : inWindowTwo ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-window-two/15 text-window-two border border-window-two/30">
                Window 2
              </span>
            ) : null}
          </div>

          <div>
            <p className="font-medium text-foreground/90">
              {holidayName ?? (status.kind === 'override' ? 'Working-Day Override' : (isOff ? 'Weekly Off Day' : 'Working Day'))}
            </p>
            {bengaliName ? <p lang="bn" className="text-[11px] text-muted-foreground">{bengaliName}</p> : null}
          </div>

          {assignments.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{assignments.length}</span> officer{assignments.length === 1 ? '' : 's'} assigned to branch visits
            </p>
          ) : null}

          <div className="pt-1.5 mt-1 border-t flex items-center justify-between text-[11px] font-semibold text-primary">
            <span>Click to view details & edit</span>
            <ArrowUpRight className="size-3.5" />
          </div>
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
    'group/cell relative flex h-full min-h-20 sm:min-h-24 flex-col justify-between overflow-hidden rounded-xl border p-2 sm:p-2.5 text-left transition-all cursor-pointer select-none',
    'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-2xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    status.kind === 'holiday'
      ? 'border-holiday/40 bg-holiday-soft'
      : status.kind === 'override'
        ? 'border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/30'
        : status.kind === 'weekly-off'
          ? inWindowOne
            ? 'border-slate-200/80 dark:border-slate-800 bg-window-one-muted-off text-muted-foreground'
            : inWindowTwo
              ? 'border-slate-200/80 dark:border-slate-800 bg-window-two-muted-off text-muted-foreground'
              : 'border-slate-200/80 dark:border-slate-800 bg-weekend text-muted-foreground'
          : inWindowOne
            ? 'border-blue-100 bg-window-one-soft/50 dark:border-blue-900/40'
            : inWindowTwo
              ? 'border-emerald-100 bg-window-two-soft/50 dark:border-emerald-900/40'
              : inMonth
                ? 'border-slate-200/90 bg-card dark:border-slate-800'
                : 'border-slate-200/60 bg-card/60 dark:border-slate-800/60 dark:bg-card/40',
    status.kind === 'weekly-off' && 'offday-hatch',
    !inMonth && 'opacity-60',
    isOfficerRange && 'outline-primary/40 outline-2 outline-offset-[-2px]',
    isToday && 'border-2 border-blue-600 ring-2 ring-inset ring-blue-600/30 dark:border-blue-500 dark:ring-blue-500/30',
  )
}

function describeDay(
  iso: string,
  status: DayStatus,
  holidayName: string | null,
  bengaliName: string | null,
  assignedCount: number,
): string {
  const countText = assignedCount > 0 ? `, ${assignedCount} officer(s) assigned` : ''
  if (holidayName) {
    const bnText = bengaliName ? ` (${bengaliName})` : ''
    return `${iso}: ${holidayName}${bnText}${countText}. Click to expand information.`
  }
  switch (status.kind) {
    case 'weekly-off':
      return `${iso}: weekly off day${countText}. Click to expand information.`
    case 'override':
      return `${iso}: working-day override${countText}. Click to expand information.`
    default:
      return `${iso}: working day${countText}. Click to expand information.`
  }
}

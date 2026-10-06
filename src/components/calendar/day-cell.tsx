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
  onAssignmentClick?: (officerId: string) => void
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
  onAssignmentClick,
}: DayCellProps) {
  const isWorking = status.kind === 'working' || status.kind === 'override'
  const isOff = status.kind === 'weekly-off'
  const isHoliday = status.kind === 'holiday'

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
          <span className="line-clamp-1 max-w-[80%] rounded bg-holiday/15 px-1 py-0.5 text-[9px] sm:text-[10px] font-medium leading-none text-holiday">
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

      {/* Assignments Display */}
      {selectedOfficerId ? (
        // Mode 1: A specific officer is selected -> spotlight that officer's assignment
        selectedAssignment ? (
          <div
            onClick={(e) => {
              e.stopPropagation()
              onAssignmentClick?.(selectedAssignment.officer.id)
            }}
            className={cn(
              'mt-auto flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium leading-tight truncate shadow-2xs transition-colors hover:brightness-95 cursor-pointer',
              selectedAssignment.windowKey === 'one'
                ? 'border-window-one/40 bg-window-one-soft text-foreground'
                : 'border-window-two/40 bg-window-two-soft text-foreground',
            )}
            title={`${selectedAssignment.officer.name}: ${selectedAssignment.branch || 'No branch assigned'}`}
          >
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                selectedAssignment.windowKey === 'one' ? 'bg-window-one' : 'bg-window-two',
              )}
            />
            <span className="font-semibold shrink-0 truncate max-w-[50%]">
              {selectedAssignment.officer.name}
            </span>
            <span className="text-muted-foreground shrink-0">·</span>
            <span className="truncate font-normal text-muted-foreground">
              {selectedAssignment.branch || '(No branch)'}
            </span>
          </div>
        ) : assignments.length > 0 && isWorking ? (
          <span className="mt-auto text-[10px] text-muted-foreground/80 pl-0.5">
            {assignments.length} other officer{assignments.length === 1 ? '' : 's'}
          </span>
        ) : null
      ) : (
        // Mode 2: All officers -> Show up to 2 assignment chips (officer + branch) + count
        isWorking && assignments.length > 0 ? (
          <div className="mt-auto flex flex-col gap-0.5 overflow-hidden w-full">
            {assignments.slice(0, 2).map((item) => (
              <div
                key={`${item.officer.id}-${item.windowKey}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onAssignmentClick?.(item.officer.id)
                }}
                className={cn(
                  'flex items-center gap-1 rounded border px-1 py-0.5 text-[10px] font-medium leading-none truncate transition-colors hover:brightness-95 cursor-pointer',
                  item.windowKey === 'one'
                    ? 'border-window-one/30 bg-window-one-soft/80 text-foreground'
                    : 'border-window-two/30 bg-window-two-soft/80 text-foreground',
                )}
                title={`${item.officer.name}: ${item.branch || 'No branch assigned'}`}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    item.windowKey === 'one' ? 'bg-window-one' : 'bg-window-two',
                  )}
                />
                <span className="font-semibold shrink-0 truncate max-w-[50%]">
                  {item.officer.name}
                </span>
                <span className="text-muted-foreground shrink-0">·</span>
                <span className="truncate text-muted-foreground font-normal">
                  {item.branch || '(none)'}
                </span>
              </div>
            ))}
            {assignments.length > 2 ? (
              <span className="text-[10px] font-medium text-muted-foreground hover:text-foreground pl-0.5">
                +{assignments.length - 2} more
              </span>
            ) : null}
          </div>
        ) : isHoliday && assignments.length > 0 ? (
          <span className="mt-auto text-[10px] text-muted-foreground/80 font-medium pl-0.5">
            {assignments.length} in window
          </span>
        ) : isOff && assignments.some((a) => a.isCustomRange) ? (
          <div className="mt-auto flex flex-col gap-0.5 overflow-hidden w-full">
            {assignments
              .filter((a) => a.isCustomRange)
              .slice(0, 1)
              .map((item) => (
                <div
                  key={`${item.officer.id}-${item.windowKey}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onAssignmentClick?.(item.officer.id)
                  }}
                  className="flex items-center gap-1 rounded border border-primary/30 bg-background/90 px-1 py-0.5 text-[10px] font-medium leading-none truncate cursor-pointer"
                  title={`${item.officer.name}: ${item.branch || 'Custom visit'}`}
                >
                  <span className="font-semibold truncate max-w-[50%]">{item.officer.name}</span>
                  <span className="text-muted-foreground shrink-0">·</span>
                  <span className="truncate text-muted-foreground">{item.branch || 'Custom'}</span>
                </div>
              ))}
          </div>
        ) : null
      )}

      {/* Manual holidays and working-day overrides carry a small marker */}
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

  if (!holidayName && status.kind !== 'override') return body

  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          <p className="font-medium">
            {holidayName ?? 'Working-day override'}
          </p>
          {bengaliName ? <p lang="bn">{bengaliName}</p> : null}
          {status.kind === 'holiday' ? (
            <p className="text-[11px] opacity-70">
              {status.holiday.source === 'imported' ? 'Imported holiday' : 'Set by hand'}
              {status.holiday.tentative ? ' · Tentative' : ''}
            </p>
          ) : (
            <p className="text-[11px] opacity-70">Counts as a working day</p>
          )}
          <p className="text-[10px] opacity-60 pt-0.5">Click to view details and assignments</p>
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
    'relative flex h-full min-h-18 sm:min-h-20 flex-col gap-0.5 overflow-hidden rounded-md border p-1 text-left transition-colors cursor-pointer select-none',
    'hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    isToday && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
    // Background precedence: a holiday always wins over the visit-window tint.
    status.kind === 'holiday'
      ? 'border-holiday bg-holiday-soft'
      : status.kind === 'override'
        ? 'border-window-one/60 bg-window-one-soft'
        : inWindowOne
          ? 'bg-window-one-soft/50'
          : inWindowTwo
            ? 'bg-window-two-soft/50'
            : inMonth
              ? 'bg-card'
              : 'bg-muted/40',
    status.kind === 'weekly-off' && 'offday-hatch text-muted-foreground',
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
  if (holidayName) return `${iso}: ${holidayName}${countText}. Click to view details and edit.`
  switch (status.kind) {
    case 'weekly-off':
      return `${iso}: weekly off day${countText}. Click to view details and edit.`
    case 'override':
      return `${iso}: working-day override${countText}. Click to view details and edit.`
    default:
      return `${iso}: working day${countText}. Click to view details and edit.`
  }
}

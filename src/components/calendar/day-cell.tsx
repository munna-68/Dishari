import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  onClick,
}: DayCellProps) {
  const body = (
    <button
      type="button"
      data-date={iso}
      aria-label={describeDay(iso, status, holidayName)}
      aria-pressed={status.kind === 'holiday'}
      className={cellClasses(status, inMonth, inWindowOne, inWindowTwo, isOfficerRange, isToday)}
      onClick={onClick}
    >
      <span className={cn('text-xs font-medium tabular-nums sm:text-sm', !inMonth && 'opacity-50')}>{date}</span>

      {status.kind === 'weekly-off' ? <span className="sr-only">weekly off day</span> : null}
      {status.kind === 'override' ? <span className="sr-only">working-day override</span> : null}


      {status.kind === 'holiday' ? (
        <span className="line-clamp-2 text-[10px] leading-tight font-medium text-holiday">
          {holidayName ?? 'Holiday'}
        </span>
      ) : null}

      {/* The selected officer's own ranges read as a thinner bar at the foot. */}
      {isOfficerRange ? <span className="mt-auto h-0.5 w-full rounded-full bg-primary/80" /> : null}

      {/* Manual holidays and working-day overrides carry a small marker. */}
      {status.kind === 'holiday' && status.holiday.source === 'manual' ? (
        <span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-holiday ring-1 ring-background" />
      ) : null}
      {status.kind === 'override' ? (
        <span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-window-one ring-1 ring-background" />
      ) : null}
      {isToday ? (
        <span className="absolute bottom-1 left-1 text-[9px] font-semibold tracking-wide uppercase opacity-70">
          Today
        </span>
      ) : null}
    </button>
  )

  if (!holidayName && status.kind !== 'override') return body

  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5">
          <p className="font-medium">
            {holidayName ?? 'Working-day override'}
          </p>
          {bengaliName ? <p lang="bn">{bengaliName}</p> : null}
          {status.kind === 'holiday' ? (
            <p className="text-xs opacity-70">
              {status.holiday.source === 'imported' ? 'Imported holiday' : 'Set by hand'}
              {status.holiday.tentative ? ' · Tentative' : ''}
            </p>
          ) : (
            <p className="text-xs opacity-70">Counts as a working day</p>
          )}
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
    'relative flex h-full min-h-16 flex-col gap-0.5 overflow-hidden rounded-md border p-1 text-left transition-colors',
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

function describeDay(iso: string, status: DayStatus, holidayName: string | null): string {
  if (holidayName) return `${iso}: ${holidayName}. Click to change the holiday status.`
  switch (status.kind) {
    case 'weekly-off':
      return `${iso}: weekly off day. Click to set a working-day override.`
    case 'override':
      return `${iso}: working-day override. Click to return it to a weekly off day.`
    default:
      return `${iso}: working day. Click to mark it as a manual holiday.`
  }
}

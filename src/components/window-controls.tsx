import { RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isValidIso, parseMonthKey } from '@/lib/date'
import { printedMonthName } from '@/lib/date-format'
import type { DateRange } from '@/lib/date-format'
import type { HolidayContext } from '@/lib/working-days'
import { countWorkingDays } from '@/lib/working-days'
import { cn } from '@/lib/utils'
import type { WindowKey } from '@/components/calendar/planner-calendar'

export interface WindowControlsProps {
  windows: Record<WindowKey, DateRange>
  context: HolidayContext
  onSetWindow: (windowKey: WindowKey, range: DateRange) => void
  onResetWindows: () => void
}

const WINDOW_LABELS: Record<WindowKey, string> = { one: 'Window 1', two: 'Window 2' }

export function WindowControls({ windows, context, onSetWindow, onResetWindows }: WindowControlsProps) {
  const workingDays: Record<WindowKey, number> = {
    one: countWorkingDays(windows.one.start, windows.one.end, context),
    two: countWorkingDays(windows.two.start, windows.two.end, context),
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <WindowField
              windowKey="one"
              range={windows.one}
              onChange={(range) => onSetWindow('one', range)}
            />
            <WindowField
              windowKey="two"
              range={windows.two}
              onChange={(range) => onSetWindow('two', range)}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onResetWindows}>
            <RotateCcw />
            Reset windows to defaults
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <WindowBadge windowKey="one" range={windows.one} workingDays={workingDays.one} />
          <WindowBadge windowKey="two" range={windows.two} workingDays={workingDays.two} />
          {workingDays.one === 0 ? (
            <span className="self-center text-xs text-destructive">
              Window 1 has no working days. Move its end onto a working day.
            </span>
          ) : null}
          {workingDays.two === 0 ? (
            <span className="self-center text-xs text-destructive">
              Window 2 has no working days. Move its end onto a working day.
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function WindowField({
  windowKey,
  range,
  onChange,
}: {
  windowKey: WindowKey
  range: DateRange
  onChange: (range: DateRange) => void
}) {
  const invalid = !isValidIso(range.start) || !isValidIso(range.end)

  return (
    <fieldset className="flex items-end gap-2">
      <legend className="sr-only">{WINDOW_LABELS[windowKey]}</legend>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${windowKey}-start`} className="text-xs text-muted-foreground">
          {WINDOW_LABELS[windowKey]} start
        </Label>
        <Input
          id={`${windowKey}-start`}
          type="date"
          value={range.start}
          min={monthBounds(range.start).min}
          max={range.end || monthBounds(range.start).max}
          onChange={(event) => onChange({ ...range, start: event.target.value })}
          className="w-40"
          aria-invalid={invalid}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${windowKey}-end`} className="text-xs text-muted-foreground">
          end
        </Label>
        <Input
          id={`${windowKey}-end`}
          type="date"
          value={range.end}
          min={range.start || monthBounds(range.end).min}
          max={monthBounds(range.end).max}
          onChange={(event) => onChange({ ...range, end: event.target.value })}
          className="w-40"
          aria-invalid={invalid}
        />
      </div>
    </fieldset>
  )
}

function WindowBadge({
  windowKey,
  range,
  workingDays,
}: {
  windowKey: WindowKey
  range: DateRange
  workingDays: number
}) {
  const label = workingDays === 1 ? '1 working day' : `${workingDays} working days`
  const month = isValidIso(range.start) ? printedMonthName(parseMonthKey(range.start.slice(0, 7))?.month ?? 1) : ''
  const startDay = isValidIso(range.start) ? range.start.slice(8, 10) : '--'
  const endDay = isValidIso(range.end) ? range.end.slice(8, 10) : '--'

  return (
    <Badge
      variant="secondary"
      className={cn(
        windowKey === 'one'
          ? 'bg-window-one-soft text-window-one-ink hover:bg-window-one-soft'
          : 'bg-window-two-soft text-window-two-ink hover:bg-window-two-soft',
      )}
    >
      {WINDOW_LABELS[windowKey]}: {startDay} to {endDay} {month}, {label}
    </Badge>
  )
}

function monthBounds(iso: string): { min: string; max: string } {
  const monthKey = iso.slice(0, 7)
  const parts = parseMonthKey(monthKey)
  if (!parts) return { min: '', max: '' }
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value))
  const lastDay = new Date(parts.year, parts.month, 0).getDate()
  return { min: `${monthKey}-01`, max: `${monthKey}-${pad(lastDay)}` }
}

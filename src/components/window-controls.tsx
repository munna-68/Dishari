import { Calendar, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isValidIso, monthBounds, pad2 } from '@/lib/date'
import type { DateRange } from '@/lib/date-format'
import type { HolidayContext } from '@/lib/working-days'
import { countWorkingDays } from '@/lib/working-days'
import type { WindowKey } from '@/lib/schema'

export interface WindowControlsProps {
  windows: Record<WindowKey, DateRange>
  context: HolidayContext
  onSetWindow: (windowKey: WindowKey, range: DateRange) => void
  onResetWindows: () => void
}

function formatDmy(iso: string): string {
  const parts = iso.split('-')
  if (parts.length === 3) return `${pad2(Number(parts[2]))}/${pad2(Number(parts[1]))}/${parts[0]}`
  return iso
}

export function WindowControls({ windows, context, onSetWindow, onResetWindows }: WindowControlsProps) {
  const workingDays: Record<WindowKey, number> = {
    one: countWorkingDays(windows.one.start, windows.one.end, context),
    two: countWorkingDays(windows.two.start, windows.two.end, context),
  }

  return (
    <Card className="rounded-xl border border-slate-200/80 shadow-2xs">
      <CardContent className="flex flex-col gap-3.5 p-4">
        {/* Header: Title and Reset button */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Window Date Ranges</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetWindows}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg px-2"
          >
            <RotateCcw className="size-3.5" />
            Reset windows to default
          </Button>
        </div>

        {/* 4 Date Inputs in responsive row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <WindowDateInput
            id="window-one-start"
            label="Window 1 start"
            value={windows.one.start}
            min={monthBounds(windows.one.start.slice(0, 7))?.min}
            max={windows.one.end || monthBounds(windows.one.start.slice(0, 7))?.max}
            onChange={(val) => onSetWindow('one', { ...windows.one, start: val })}
          />
          <WindowDateInput
            id="window-one-end"
            label="Window 1 end"
            value={windows.one.end}
            min={windows.one.start || monthBounds(windows.one.end.slice(0, 7))?.min}
            max={monthBounds(windows.one.end.slice(0, 7))?.max}
            onChange={(val) => onSetWindow('one', { ...windows.one, end: val })}
          />
          <WindowDateInput
            id="window-two-start"
            label="Window 2 start"
            value={windows.two.start}
            min={monthBounds(windows.two.start.slice(0, 7))?.min}
            max={windows.two.end || monthBounds(windows.two.start.slice(0, 7))?.max}
            onChange={(val) => onSetWindow('two', { ...windows.two, start: val })}
          />
          <WindowDateInput
            id="window-two-end"
            label="Window 2 end"
            value={windows.two.end}
            min={windows.two.start || monthBounds(windows.two.end.slice(0, 7))?.min}
            max={monthBounds(windows.two.end.slice(0, 7))?.max}
            onChange={(val) => onSetWindow('two', { ...windows.two, end: val })}
          />
        </div>

        {/* Window Summary Badges */}
        <div className="flex flex-wrap gap-2.5 pt-0.5">
          <div className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50">
            Window 1: {formatDmy(windows.one.start)} – {workingDays.one} working days
          </div>
          <div className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50">
            Window 2: {formatDmy(windows.two.start)} – {workingDays.two} working days
          </div>
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

function WindowDateInput({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  value: string
  min?: string
  max?: string
  onChange: (val: string) => void
}) {
  const invalid = !isValidIso(value)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </Label>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="h-9.5 w-full rounded-xl pl-9 pr-3 text-xs sm:text-sm font-medium border-slate-200 dark:border-slate-800"
          aria-invalid={invalid}
        />
      </div>
    </div>
  )
}

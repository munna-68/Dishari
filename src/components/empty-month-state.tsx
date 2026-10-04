import { FileSpreadsheet, Sparkles, SquarePen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { monthLabel } from '@/lib/date'

export interface EmptyMonthStateProps {
  monthKey: string
  onStartFromLastMonth: () => void
  onStartBlank: () => void
  onLoadSample: () => void
  previousMonthHasList: boolean
}

export function EmptyMonthState({
  monthKey,
  onStartFromLastMonth,
  onStartBlank,
  onLoadSample,
  previousMonthHasList,
}: EmptyMonthStateProps) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="px-6 pt-6">
        <CardTitle className="text-xl">{monthLabel(monthKey)} is not set up yet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-6">
        <p className="text-sm text-muted-foreground">
          Each month has its own saved schedule. Pick how you want to start this one.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onStartFromLastMonth} disabled={!previousMonthHasList} className="flex-1">
            <Sparkles />
            Start from last month
          </Button>
          <Button variant="outline" onClick={onStartBlank} className="flex-1">
            <SquarePen />
            Start blank
          </Button>
        </div>

        {previousMonthHasList ? null : (
          <p className="text-xs text-muted-foreground">
            Last month has no saved schedule, so carry-over is unavailable. Start blank instead.
          </p>
        )}

        <Button variant="ghost" onClick={onLoadSample} className="w-full">
          <FileSpreadsheet />
          Load sample: October 2026
        </Button>

        <p className="text-xs text-muted-foreground">
          Starting from last month carries the activity list and the temporary officers across and clears every
          branch and custom date. Starting blank gives you the nine permanent officers and default windows.
        </p>
      </CardContent>
    </Card>
  )
}

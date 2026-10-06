import { FileSpreadsheet, History, Sparkles, SquarePen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { monthLabel, shiftMonthKey } from '@/lib/date'

export interface EmptyMonthStateProps {
  monthKey: string
  onLoadDefaultData: () => void
  onStartBlank: () => void
  onStartFromLastMonth: () => void
  onLoadSample?: () => void
  previousMonthHasList: boolean
}

export function EmptyMonthState({
  monthKey,
  onLoadDefaultData,
  onStartBlank,
  onStartFromLastMonth,
  onLoadSample,
  previousMonthHasList,
}: EmptyMonthStateProps) {
  const currentMonthName = monthLabel(monthKey)
  const previousKey = shiftMonthKey(monthKey, -1)
  const previousMonthName = monthLabel(previousKey)

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="px-6 pt-6 pb-2">
        <CardTitle className="text-xl">{currentMonthName} is not set up yet</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Each month has its own saved schedule. Pick how you want to start this one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-lg border bg-card p-4 transition-all hover:border-primary/50">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Sparkles className="size-4 text-primary" />
                <span>Load default data</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pre-fills 9 permanent officers, 2 temporary monitoring managers, standard activities, and sample branch assignments.
              </p>
            </div>
            <Button onClick={onLoadDefaultData} className="mt-4 w-full">
              <Sparkles className="size-4" />
              Load default data
            </Button>
          </div>

          <div className="flex flex-col justify-between rounded-lg border bg-card p-4 transition-all hover:border-muted-foreground/50">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-sm">
                <SquarePen className="size-4 text-muted-foreground" />
                <span>Start blank</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Starts fresh with the 9 permanent officers, standard activities, and default date windows. No branches or temporary managers.
              </p>
            </div>
            <Button variant="outline" onClick={onStartBlank} className="mt-4 w-full">
              <SquarePen className="size-4" />
              Start blank
            </Button>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="rounded-lg border border-dashed bg-muted/30 p-3.5 text-center space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onStartFromLastMonth}
              disabled={!previousMonthHasList}
              className="w-full sm:w-auto"
            >
              <History className="size-4" />
              Start from last month ({previousMonthName})
            </Button>
            <p className="text-xs text-muted-foreground">
              {previousMonthHasList
                ? `Carries over the activity list and temporary officers from ${previousMonthName}, clearing branch assignments and custom dates.`
                : `Last month (${previousMonthName}) has no saved schedule, so carry-over is unavailable. Start blank or load default data instead.`}
            </p>
          </div>
        </div>

        {onLoadSample && monthKey !== '2026-10' ? (
          <div className="text-center pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadSample}
              className="text-xs text-muted-foreground hover:text-foreground h-auto py-1"
            >
              <FileSpreadsheet className="size-3.5 mr-1" />
              Load benchmark sample: October 2026
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

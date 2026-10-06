import { useState } from 'react'
import { ClipboardCopy, ClipboardPaste, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { WEEKDAY_LONG, monthIsoDays, parseMonthKey } from '@/lib/date'
import { buildHolidayPrompt, describePromptScope, type PromptScope } from '@/lib/holidays'
import { cn } from '@/lib/utils'
import type { HolidayState } from '@/lib/working-days'

export interface HolidaysTabProps {
  monthKey: string
  holidays: HolidayState
  weeklyOffDays: number[]
  onImport: (text: string) => void
  onRemove: (iso: string) => void
  onClearImportedInMonth: () => void
  className?: string
}

export function HolidaysTab({
  monthKey,
  holidays,
  weeklyOffDays,
  onImport,
  onRemove,
  onClearImportedInMonth,
  className,
}: HolidaysTabProps) {
  const [scopeKind, setScopeKind] = useState<'month' | 'year'>('month')

  const parts = parseMonthKey(monthKey)
  const year = parts?.year ?? 0
  const month = parts?.month ?? 1
  const monthDays = parts ? monthIsoDays(year, month) : []
  const monthHolidays = monthDays
    .map((iso) => ({ iso, holiday: holidays.holidays[iso] }))
    .filter((entry) => entry.holiday !== undefined)
    .sort((a, b) => a.iso.localeCompare(b.iso))

  const scope: PromptScope = { kind: scopeKind, year, month }
  const prompt = buildHolidayPrompt(scope)
  const [promptToCopy, setPromptToCopy] = useState<string | null>(null)

  async function handleCopyPrompt() {
    const copied = await writeToClipboard(prompt)
    if (copied) toast.success('Prompt copied to your clipboard.')
    else setPromptToCopy(prompt)
  }

  if (!parts) return null

  return (
    <Card className={cn('flex h-full w-full flex-col min-h-0', className)}>
      <CardHeader className="shrink-0 px-4 py-3">
        <CardTitle className="text-base">Holidays</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto px-4 pb-4">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Weekly off days</h3>
          <p className="text-xs text-muted-foreground">
            {weeklyOffDays.length === 0
              ? 'No weekly off days, so every day counts as a working day.'
              : weeklyOffDays.map((index) => WEEKDAY_LONG[index]).join(' and ')}
          </p>
          <p className="text-xs text-muted-foreground">
            Change these in Settings. On the calendar they are the two right-most columns.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Get the official holiday list</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="holiday-scope" className="text-xs text-muted-foreground">
                Fetch holidays for
              </label>
              <Select value={scopeKind} onValueChange={(value) => setScopeKind(value === 'year' ? 'year' : 'month')}>
                <SelectTrigger id="holiday-scope" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">This month only</SelectItem>
                  <SelectItem value="year">The whole year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopyPrompt()}
            >
              <ClipboardCopy />
              Copy prompt
            </Button>
            <Button size="sm" onClick={() => onImport(prompt)}>
              <ClipboardPaste />
              Import JSON
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Copy the prompt into an AI assistant that can browse the web, paste the JSON it returns into
            the import dialog, then review the rows before applying them. The prompt asks for{' '}
            {describePromptScope(scope)}.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              Holidays in this month <span className="text-muted-foreground">({monthHolidays.length})</span>
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearImportedInMonth}
              disabled={!monthHolidays.some((entry) => entry.holiday?.source === 'imported')}
            >
              <Trash2 />
              Clear imported holidays for this month
            </Button>
          </div>

          {monthHolidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No holidays recorded for this month. Import a list, or click dates on the calendar to set them
              by hand.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {monthHolidays.map(({ iso, holiday }) => (
                <li key={iso} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{iso}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {holiday?.nameEn || 'Manual holiday'}
                    {holiday?.nameBn ? <span lang="bn"> · {holiday.nameBn}</span> : null}
                  </span>
                  <Badge variant={holiday?.source === 'imported' ? 'secondary' : 'outline'}>
                    {holiday?.source === 'imported' ? 'Imported' : 'By hand'}
                  </Badge>
                  {holiday?.tentative ? <Badge variant="outline">Tentative</Badge> : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(iso)}
                    aria-label={`Remove the holiday on ${iso}`}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <HolidaysElsewhereWarning holidays={holidays} monthKey={monthKey} />

        <Dialog open={promptToCopy !== null} onOpenChange={(open) => !open && setPromptToCopy(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Copy this prompt</DialogTitle>
              <DialogDescription>
                The browser blocked clipboard access. Select the text below and copy it by hand.
              </DialogDescription>
            </DialogHeader>
            <textarea
              readOnly
              aria-label="Holiday prompt"
              value={promptToCopy ?? ''}
              onFocus={(event) => event.currentTarget.select()}
              className="h-64 w-full rounded-md border bg-muted/40 p-2 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            <DialogFooter>
              <Button onClick={() => setPromptToCopy(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function HolidaysElsewhereWarning({ holidays, monthKey }: { holidays: HolidayState; monthKey: string }) {
  const otherMonths = new Set(
    Object.keys(holidays.holidays)
      .filter((iso) => !iso.startsWith(monthKey))
      .map((iso) => iso.slice(0, 7)),
  )
  if (otherMonths.size === 0) return null
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      You also have holidays stored for {otherMonths.size} other month
      {otherMonths.size === 1 ? '' : 's'}. Importing merges into them and never deletes them.
    </p>
  )
}

/** Copies text, reporting failure so the caller can offer a manual fallback. */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

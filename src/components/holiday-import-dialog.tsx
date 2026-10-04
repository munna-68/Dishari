import { useMemo, useState } from 'react'
import { CircleCheck, CircleX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { parseHolidayInput, type ParsedHolidayRow } from '@/lib/holidays'

export interface HolidayImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefilled text, used by the Copy prompt action. */
  initialText: string
  onApply: (rows: ParsedHolidayRow[]) => void
}

export function HolidayImportDialog({ open, onOpenChange, initialText, onApply }: HolidayImportDialogProps) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ParsedHolidayRow[]>([])
  const [hasParsed, setHasParsed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Start from a clean sheet each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText(initialText)
      setHasParsed(false)
      setRows([])
      setSelected(new Set())
    }
  }

  const validRows = useMemo(() => rows.filter((row) => row.valid), [rows])
  const invalidRows = useMemo(() => rows.filter((row) => !row.valid), [rows])

  function parse() {
    const parsed = parseHolidayInput(text)
    setRows(parsed)
    setHasParsed(true)
    setSelected(new Set(parsed.filter((row) => row.valid).map((row) => row.key)))
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function apply() {
    const chosen = validRows.filter((row) => selected.has(row.key))
    onApply(chosen)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import holidays</DialogTitle>
          <DialogDescription>
            Paste the JSON an AI assistant returned. Code fences and extra prose are ignored, and alternative
            field names for the date and name are accepted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setHasParsed(false)
            }}
            placeholder='{"year": 2026, "holidays": [{"date": "2026-02-15", "name": "...", "nameBn": "..."}]}'
            aria-label="Holiday JSON to import"
            className="h-40 font-mono text-xs"
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={parse} disabled={text.trim() === ''}>
              Review the list
            </Button>
            {hasParsed && validRows.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set(validRows.map((row) => row.key)))}
              >
                Select all valid
              </Button>
            ) : null}
            {hasParsed && validRows.length > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            ) : null}
          </div>

          {hasParsed ? (
            <div className="space-y-2">
              {invalidRows.length > 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <CircleX className="size-4 shrink-0" aria-hidden />
                  {invalidRows.length} row{invalidRows.length === 1 ? '' : 's'} could not be read and will be
                  skipped.
                </p>
              ) : null}

              <ScrollArea className="max-h-72 rounded-md border">
                <ul className="divide-y">
                  {rows.map((row) => (
                    <li key={row.key} className="flex items-start gap-3 px-3 py-2 text-sm">
                      <Checkbox
                        checked={row.valid && selected.has(row.key)}
                        disabled={!row.valid}
                        onCheckedChange={() => toggle(row.key)}
                        aria-label={`Include ${row.date ?? row.rawDate}`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="tabular-nums">{row.date ?? (row.rawDate || 'no date')}</span>
                          {row.valid ? (
                            <Badge variant="secondary">{row.nameEn}</Badge>
                          ) : (
                            <span className="text-destructive">{row.error}</span>
                          )}
                          {row.tentative ? <Badge variant="outline">Tentative</Badge> : null}
                        </div>
                        {row.nameBn ? (
                          <p lang="bn" className="text-xs text-muted-foreground">
                            {row.nameBn}
                          </p>
                        ) : null}
                      </div>
                      {row.valid ? (
                        <CircleCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ScrollArea>

              <Separator />

              <p className="text-xs text-muted-foreground">
                Importing merges. Holidays in other months are kept, and any date you set by hand is never
                overwritten. Names on dates that already exist are refreshed.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!hasParsed || selected.size === 0}>
            Apply {selected.size > 0 ? `${selected.size} holiday${selected.size === 1 ? '' : 's'}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

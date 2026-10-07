import { useMemo, useState } from 'react'
import { Check, CircleCheck, CircleX, ClipboardCopy } from 'lucide-react'
import { toast } from 'sonner'

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
import { cn } from '@/lib/utils'

export interface HolidayImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Instruction / prompt text to display at the top of the dialog. */
  prompt?: string
  /** Prefilled text for the JSON input, if any (defaults to empty). */
  initialText?: string
  onApply: (rows: ParsedHolidayRow[]) => void
}

export function HolidayImportDialog({
  open,
  onOpenChange,
  prompt = '',
  initialText = '',
  onApply,
}: HolidayImportDialogProps) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ParsedHolidayRow[]>([])
  const [hasParsed, setHasParsed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Start from a clean sheet each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText(initialText)
      setHasParsed(false)
      setRows([])
      setSelected(new Set())
      setCopiedPrompt(false)
    }
  }

  const validRows = useMemo(() => rows.filter((row) => row.valid), [rows])
  const invalidRows = useMemo(() => rows.filter((row) => !row.valid), [rows])

  async function handleCopyPrompt() {
    if (!prompt) return
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(prompt)
        setCopiedPrompt(true)
        toast.success('Prompt copied to clipboard.')
        setTimeout(() => setCopiedPrompt(false), 2000)
        return
      }
    } catch {
      // clipboard access might be denied
    }
    toast.info('You can select and copy the prompt text below.')
  }

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
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Import holidays</DialogTitle>
          <DialogDescription>
            Paste the JSON an AI assistant returned. Code fences and extra prose are ignored automatically,
            and alternative field names for the date and name are accepted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto pr-1">
          {/* Instructions at top */}
          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">How to get the holiday JSON</span>
              {prompt ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={() => void handleCopyPrompt()}
                >
                  {copiedPrompt ? <Check className="size-3.5 text-green-600" /> : <ClipboardCopy className="size-3.5" />}
                  {copiedPrompt ? 'Copied' : 'Copy prompt'}
                </Button>
              ) : null}
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
              <li>Ask an AI assistant to get official holidays using the prompt.</li>
              <li>Paste the returned JSON into the field below.</li>
              <li>Click <strong>Review the list</strong> to inspect and apply the holidays.</li>
            </ol>
            {prompt ? (
              <details className="group pt-1">
                <summary className="cursor-pointer select-none text-[11px] font-medium text-primary hover:underline">
                  View full prompt instructions
                </summary>
                <pre className="mt-1.5 max-h-32 overflow-y-auto rounded border bg-background/80 p-2 font-mono text-[11px] leading-relaxed select-all whitespace-pre-wrap text-foreground">
                  {prompt}
                </pre>
              </details>
            ) : null}
          </div>

          {/* Input field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="holiday-json-input" className="text-xs font-medium">
                Paste JSON here
              </label>
              {hasParsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setHasParsed(false)}
                >
                  Edit JSON
                </Button>
              ) : null}
            </div>
            <Textarea
              id="holiday-json-input"
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                setHasParsed(false)
              }}
              placeholder='{"year": 2026, "holidays": [{"date": "2026-02-15", "name": "...", "nameBn": "..."}]}'
              aria-label="Holiday JSON to import"
              className={cn('font-mono text-xs transition-[height]', hasParsed ? 'h-24' : 'h-36')}
            />
          </div>

          {/* Reviewed list section */}
          {hasParsed ? (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {validRows.length > 0
                    ? `${validRows.length} holiday${validRows.length === 1 ? '' : 's'} found (${selected.size} selected)`
                    : 'No valid holidays found'}
                </span>
                {validRows.length > 0 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setSelected(new Set(validRows.map((row) => row.key)))}
                    >
                      Select all valid
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setSelected(new Set())}
                    >
                      Clear selection
                    </Button>
                  </div>
                ) : null}
              </div>

              {invalidRows.length > 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                  <CircleX className="size-4 shrink-0" aria-hidden />
                  <span>
                    {invalidRows.length} row{invalidRows.length === 1 ? '' : 's'} could not be read and will be
                    skipped.
                  </span>
                </div>
              ) : null}

              {rows.length > 0 ? (
                <ScrollArea className="max-h-60 rounded-md border">
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
                            <span className="tabular-nums font-mono text-xs">{row.date ?? (row.rawDate || 'no date')}</span>
                            {row.valid ? (
                              <Badge variant="secondary">{row.nameEn}</Badge>
                            ) : (
                              <span className="text-xs text-destructive">{row.error}</span>
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
              ) : null}

              <Separator />

              <p className="text-xs text-muted-foreground">
                Importing merges. Holidays in other months are kept, and any date you set by hand is never
                overwritten. Names on dates that already exist are refreshed.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!hasParsed ? (
            <Button onClick={parse} disabled={text.trim() === ''}>
              Review the list
            </Button>
          ) : (
            <Button onClick={apply} disabled={selected.size === 0}>
              Apply {selected.size > 0 ? `for ${selected.size} holiday${selected.size === 1 ? '' : 's'}` : 'holidays'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

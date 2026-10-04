import { useState } from 'react'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { WEEKDAY_LONG } from '@/lib/date'
import type { AppSettings } from '@/lib/schema'
import { cn } from '@/lib/utils'

export interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

export function SettingsDialog({ open, onOpenChange, settings, onChange }: SettingsDialogProps) {
  const [roster, setRoster] = useState(settings.defaultPermanentRoster.join('\n'))
  const [newName, setNewName] = useState('')
  // Reload the draft from the roster each time the dialog is opened.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setRoster(settings.defaultPermanentRoster.join('\n'))
  }

  function toggleOffDay(index: number) {
    const next = settings.weeklyOffDays.includes(index)
      ? settings.weeklyOffDays.filter((day) => day !== index)
      : [...settings.weeklyOffDays, index].sort((a, b) => a - b)
    onChange({ weeklyOffDays: next })
  }

  function saveRoster() {
    const names = roster
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    onChange({ defaultPermanentRoster: names })
  }

  function addRosterName() {
    const name = newName.trim()
    if (name === '') return
    onChange({ defaultPermanentRoster: [...settings.defaultPermanentRoster, name] })
    setNewName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            These apply to every month. Each month keeps its own officers, branches and dates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Document heading</h3>
            <Field label="Organisation" value={settings.organization} onChange={(organization) => onChange({ organization })} />
            <Field label="Department" value={settings.department} onChange={(department) => onChange({ department })} />
            <Field label="Programme" value={settings.program} onChange={(program) => onChange({ program })} />
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Weekly off days</h3>
            <p className="text-xs text-muted-foreground">
              Fridays and Saturdays are off by default, which puts them in the two right-most calendar
              columns. Holidays are never counted as working days.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LONG.map((label, index) => {
                const active = settings.weeklyOffDays.includes(index)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleOffDay(index)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Permanent roster</h3>
            <p className="text-xs text-muted-foreground">
              One name per line. Base capacity is nine officers. Renaming a permanent officer on the Officers
              panel also updates this roster.
            </p>
            <textarea
              value={roster}
              onChange={(event) => setRoster(event.target.value)}
              onBlur={saveRoster}
              rows={Math.min(12, Math.max(6, roster.split('\n').length))}
              aria-label="Permanent roster"
              className="w-full rounded-md border bg-transparent p-2 font-mono text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            <div className="flex items-end gap-1.5">
              <div className="flex-1">
                <Label htmlFor="roster-add" className="text-xs text-muted-foreground">
                  Add a name
                </Label>
                <Input
                  id="roster-add"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addRosterName()
                  }}
                  placeholder="e.g. Rafiqul Islam"
                  className="h-8"
                />
              </div>
              <Button size="sm" onClick={addRosterName} disabled={newName.trim() === ''}>
                <Plus />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {settings.defaultPermanentRoster.length} permanent officer
              {settings.defaultPermanentRoster.length === 1 ? '' : 's'} in the roster.
            </p>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Export options</h3>
            <ToggleRow
              label="Merge identical adjacent temporary branch cells"
              hint="In September two temporary officers shared one 'Issue-Based Monitoring' cell."
              checked={settings.mergeIdenticalTemporaryCells}
              onChange={(mergeIdenticalTemporaryCells) => onChange({ mergeIdenticalTemporaryCells })}
            />
            <ToggleRow
              label="Show a cross mark beside temporary names"
              hint="Prints '× Maydul Islam' so the temporary staff stand out."
              checked={settings.crossMarkTemporaryNames}
              onChange={(crossMarkTemporaryNames) => onChange({ crossMarkTemporaryNames })}
            />
            <ToggleRow
              label="Split displayed date ranges around holidays"
              hint="Off, the printed text stays a continuous range such as '05-16 July' like the paper sheets."
              checked={settings.splitRangesAroundHolidays}
              onChange={(splitRangesAroundHolidays) => onChange({ splitRangesAroundHolidays })}
            />
          </section>

          <Separator />

          <section className="space-y-1">
            <h3 className="text-sm font-semibold">Remembered values</h3>
            <p className="text-xs text-muted-foreground">
              {settings.recentTemporaryNames.length} recent temporary name
              {settings.recentTemporaryNames.length === 1 ? '' : 's'} (maximum 20) and{' '}
              {settings.recentBranchNames.length} branch name
              {settings.recentBranchNames.length === 1 ? '' : 's'} (maximum 150).
            </p>
            {settings.recentBranchNames.length > 0 ? (
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto pt-1">
                {settings.recentBranchNames.slice(0, 40).map((branch) => (
                  <span
                    key={branch}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                  >
                    {branch}
                    <button
                      type="button"
                      aria-label={`Forget ${branch}`}
                      onClick={() =>
                        onChange({
                          recentBranchNames: settings.recentBranchNames.filter((entry) => entry !== branch),
                        })
                      }
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = `setting-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="w-32 shrink-0 text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-8" />
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = `toggle-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

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
import { WEEKDAY_LONG } from '@/lib/date'
import { DEFAULT_BRANCHES, type AppSettings } from '@/lib/schema'
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
  const [newBranch, setNewBranch] = useState('')
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

  function addBranch() {
    const branch = newBranch.trim()
    if (branch === '') return
    const exists = settings.recentBranchNames.some(
      (b) => b.trim().toLowerCase() === branch.toLowerCase(),
    )
    if (!exists) {
      onChange({ recentBranchNames: [...settings.recentBranchNames, branch] })
    }
    setNewBranch('')
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

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Branches</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onChange({ recentBranchNames: [...DEFAULT_BRANCHES] })}
                title="Reset branches to default list"
              >
                Reset to defaults
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Branches available for monthly schedules. These appear as suggestions in assignment cells and day details.
            </p>

            <div className="flex items-end gap-1.5">
              <div className="flex-1">
                <Label htmlFor="branch-add" className="text-xs text-muted-foreground">
                  Add a branch
                </Label>
                <Input
                  id="branch-add"
                  value={newBranch}
                  onChange={(event) => setNewBranch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addBranch()
                    }
                  }}
                  placeholder="e.g. Patgram Sadar, Lalmonirhat"
                  className="h-8"
                />
              </div>
              <Button size="sm" onClick={addBranch} disabled={newBranch.trim() === ''}>
                <Plus />
                Add
              </Button>
            </div>

            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pt-1">
              {settings.recentBranchNames.map((branch) => (
                <span
                  key={branch}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-xs"
                >
                  <span>{branch}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${branch}`}
                    onClick={() =>
                      onChange({
                        recentBranchNames: settings.recentBranchNames.filter((entry) => entry !== branch),
                      })
                    }
                    className="rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
              {settings.recentBranchNames.length === 0 && (
                <p className="text-xs italic text-muted-foreground py-1">
                  No branches configured. Click &ldquo;Reset to defaults&rdquo; or add branches above.
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {settings.recentBranchNames.length} branch
              {settings.recentBranchNames.length === 1 ? '' : 'es'} configured.
            </p>
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

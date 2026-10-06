import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, UserRoundPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Officer } from '@/lib/schema'
import { cn } from '@/lib/utils'

export const MAX_VISIBLE_RECENT_CHIPS = 8

export interface OfficersPanelProps {
  officers: Officer[]
  recentNames: string[]
  selectedOfficerId: string | null
  onSelect: (officerId: string | null) => void
  onAddTemporary: (name: string) => void
  onDismissRecent: (name: string) => void
  onToggleCrossOut: (officerId: string) => void
  onRename: (officerId: string, name: string) => void
  onRemove: (officerId: string) => void
  onReorder: (activeId: string, overId: string) => void
  onSetRoster: () => void
  className?: string
}

export function OfficersPanel({
  officers,
  recentNames,
  selectedOfficerId,
  onSelect,
  onAddTemporary,
  onDismissRecent,
  onToggleCrossOut,
  onRename,
  onRemove,
  onReorder,
  onSetRoster,
  className,
}: OfficersPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const permanent = officers.filter((officer) => officer.kind === 'permanent')
  const temporary = officers.filter((officer) => officer.kind === 'temporary')
  const visibleRecent = recentNames.slice(0, MAX_VISIBLE_RECENT_CHIPS)

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId) return
    onReorder(activeId, overId)
  }

  return (
    <Card className={cn('flex min-h-0 flex-col', className)}>
      <CardHeader className="gap-1 px-4 py-3">
        <CardTitle className="text-base">Officers</CardTitle>
        <p className="text-xs text-muted-foreground">
          {countText(permanent.length, temporary.length)}
        </p>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
        <AddTemporaryOfficer
          recentNames={recentNames}
          existingNames={officers.map((officer) => officer.name)}
          onAdd={onAddTemporary}
        />

        {visibleRecent.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Recent temporary names</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleRecent.map((name) => (
                <RecentChip
                  key={name}
                  name={name}
                  onAdd={onAddTemporary}
                  onDismiss={() => onDismissRecent(name)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <Separator />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <ScrollArea className="-mx-1 max-h-[26rem] min-h-0 flex-1 px-1 xl:max-h-full">
            <div className="space-y-4 pr-1">
              <OfficerGroup
                title="Permanent"
                officers={permanent}
                selectedOfficerId={selectedOfficerId}
                onSelect={onSelect}
                onToggleCrossOut={onToggleCrossOut}
                onRename={onRename}
              />
              {temporary.length > 0 ? (
                <OfficerGroup
                  title="Temporary"
                  officers={temporary}
                  selectedOfficerId={selectedOfficerId}
                  onSelect={onSelect}
                  onToggleCrossOut={onToggleCrossOut}
                  onRename={onRename}
                  onRemove={onRemove}
                />
              ) : null}
            </div>
          </ScrollArea>
        </DndContext>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onSetRoster}
              className="w-full text-center whitespace-normal"
            >
              Reset permanent officers from the roster
            </Button>
          </TooltipTrigger>
          <TooltipContent>Replaces the permanent officers with the roster saved in Settings.</TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  )
}

function OfficerGroup({
  title,
  officers,
  selectedOfficerId,
  onSelect,
  onToggleCrossOut,
  onRename,
  onRemove,
}: {
  title: string
  officers: Officer[]
  selectedOfficerId: string | null
  onSelect: (officerId: string) => void
  onToggleCrossOut: (officerId: string) => void
  onRename: (officerId: string, name: string) => void
  onRemove?: (officerId: string) => void
}) {
  if (officers.length === 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">None yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
        {title} · {officers.length}
      </p>
      <SortableContext items={officers.map((officer) => officer.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {officers.map((officer) => (
            <li key={officer.id}>
              <OfficerCard
                officer={officer}
                isSelected={officer.id === selectedOfficerId}
                onSelect={() => onSelect(officer.id)}
                onToggleCrossOut={() => onToggleCrossOut(officer.id)}
                onRename={(name) => onRename(officer.id, name)}
                onRemove={onRemove ? () => onRemove(officer.id) : undefined}
              />
            </li>
          ))}
        </ul>
      </SortableContext>
    </div>
  )
}

function OfficerCard({
  officer,
  isSelected,
  onSelect,
  onToggleCrossOut,
  onRename,
  onRemove,
}: {
  officer: Officer
  isSelected: boolean
  onSelect: () => void
  onToggleCrossOut: () => void
  onRename: (name: string) => void
  onRemove?: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: officer.id })
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(officer.name)

  function commit() {
    const next = draft.trim()
    if (next !== '' && next !== officer.name) onRename(next)
    else setDraft(officer.name)
    setIsEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card p-2',
        isDragging && 'z-10 opacity-70 shadow-md',
        officer.crossedOut && 'bg-muted/60',
        isSelected && 'ring-primary/50 ring-2',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${officer.name}`}
        className="text-muted-foreground cursor-grab touch-none rounded-sm p-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <span
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold',
          officer.crossedOut && 'line-through',
        )}
      >
        {initials(officer.name)}
      </span>

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') {
                setDraft(officer.name)
                setIsEditing(false)
              }
            }}
            aria-label={`Rename ${officer.name}`}
            className="h-7 py-0 text-sm"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setIsEditing(true)}
            onClick={onSelect}
            className={cn(
              'block max-w-full truncate text-left text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              officer.crossedOut && 'text-muted-foreground line-through',
            )}
            title="Click to highlight their dates. Double-click to rename."
          >
            {officer.name}
          </button>
        )}
        <Badge
          variant={officer.kind === 'permanent' ? 'secondary' : 'outline'}
          className="mt-0.5 px-1 py-0 text-[10px]"
        >
          {officer.kind === 'permanent' ? 'Permanent' : 'Temporary'}
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCrossOut}
              aria-label={officer.crossedOut ? `Restore ${officer.name}` : `Cross out ${officer.name}`}
            >
              {officer.crossedOut ? '↩' : '✕'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {officer.crossedOut
              ? 'Put this officer back in the table and exports'
              : 'Leave this officer out of the table and exports for this month'}
          </TooltipContent>
        </Tooltip>

        {onRemove ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${officer.name}`}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove this temporary officer from {officer.name}&apos;s month</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}

function AddTemporaryOfficer({
  recentNames,
  existingNames,
  onAdd,
}: {
  recentNames: string[]
  existingNames: string[]
  onAdd: (name: string) => void
}) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const trimmed = value.trim()

  const existingLower = new Set(existingNames.map((name) => name.trim().toLowerCase()))
  const suggestions = recentNames.filter((name) => !existingLower.has(name.trim().toLowerCase()))

  function submit() {
    if (trimmed === '') return
    onAdd(trimmed)
    setValue('')
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <label htmlFor="add-temporary" className="text-xs font-medium text-muted-foreground">
        Add a temporary officer
      </label>
      <Input
        id="add-temporary"
        value={value}
        placeholder="Name, then press Enter"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
        className="h-9 w-full"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={trimmed === ''} className="flex-1">
          <UserRoundPlus className="size-4" />
          Add
        </Button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Browse recent names">
              Recent
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <Command>
              <CommandInput placeholder="Search recent names" value={value} onValueChange={setValue} />
              <CommandList>
                <CommandEmpty>No recent names yet.</CommandEmpty>
                <CommandGroup heading="Recent">
                  {suggestions.map((name) => (
                    <CommandItem
                      key={name}
                      value={name}
                      onSelect={() => {
                        onAdd(name)
                        setValue('')
                        setOpen(false)
                      }}
                    >
                      {name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {trimmed !== '' && existingLower.has(trimmed.toLowerCase()) ? (
        <p className="text-xs text-destructive">{trimmed} is already in this month&apos;s list.</p>
      ) : null}
    </div>
  )
}

function RecentChip({
  name,
  onAdd,
  onDismiss,
}: {
  name: string
  onAdd: (name: string) => void
  onDismiss: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-secondary py-0.5 pr-0.5 pl-2 text-xs">
      <button
        type="button"
        onClick={() => onAdd(name)}
        className="rounded-full hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {name}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Forget ${name}`}
        className="text-muted-foreground rounded-full px-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        ✕
      </button>
    </span>
  )
}

function countText(permanent: number, temporary: number): string {
  return `${permanent} permanent, ${temporary} temporary`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

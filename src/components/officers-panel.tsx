import { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, PanelLeftClose, Trash2, Undo2, UserRoundPlus } from 'lucide-react'

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
  rosterNames?: string[]
  recentNames: string[]
  selectedOfficerId: string | null
  defaultMode?: 'permanent' | 'temporary'
  onSelect: (officerId: string | null) => void
  onAddPermanent?: (name: string) => void
  onAddTemporary: (name: string) => void
  onDismissRecent: (name: string) => void
  onToggleCrossOut: (officerId: string) => void
  onRename: (officerId: string, name: string) => void
  onRemove: (officerId: string) => void
  onReorder: (activeId: string, overId: string) => void
  onSetRoster: () => void
  className?: string
  onCollapse?: () => void
}

export function OfficersPanel({
  officers,
  rosterNames = [],
  recentNames,
  selectedOfficerId,
  defaultMode = 'temporary',
  onSelect,
  onAddPermanent,
  onAddTemporary,
  onDismissRecent,
  onToggleCrossOut,
  onRename,
  onRemove,
  onReorder,
  onSetRoster,
  className,
  onCollapse,
}: OfficersPanelProps) {
  const [mode, setMode] = useState<'permanent' | 'temporary'>(defaultMode)
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const permanent = officers.filter((officer) => officer.kind === 'permanent')
  const temporary = officers.filter((officer) => officer.kind === 'temporary')
  const visibleRecent = recentNames.slice(0, MAX_VISIBLE_RECENT_CHIPS)

  // Identify permanent roster officers that are either not in this month or crossed out (left out of table)
  const rosterStatus = rosterNames.map((name) => {
    const existing = officers.find((o) => o.name.trim().toLowerCase() === name.trim().toLowerCase())
    return {
      name,
      existing,
      isInMonth: existing !== undefined,
      isCrossedOut: existing?.crossedOut === true,
    }
  })

  const reenterableRosterOfficers = rosterStatus.filter(
    (item) => !item.isInMonth || item.isCrossedOut,
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeOfficer = activeId ? officers.find((o) => o.id === activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId || activeId === overId) return
    onReorder(activeId, overId)
  }

  function handleAddPermanent(name: string) {
    if (onAddPermanent) onAddPermanent(name)
    else onAddTemporary(name)
  }

  return (
    <Card className={cn('flex min-h-0 flex-col', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-4 py-3 space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-base">Officers</CardTitle>
          <p className="text-xs text-muted-foreground">
            {countText(permanent.length, temporary.length)}
          </p>
        </div>
        {onCollapse ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onCollapse}
                aria-label="Collapse officers panel"
                className="text-muted-foreground hover:text-foreground shrink-0 -mr-1"
              >
                <PanelLeftClose className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse panel (Ctrl+[ or Alt+O)</TooltipContent>
          </Tooltip>
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
        <AddOfficer
          mode={mode}
          onModeChange={setMode}
          officers={officers}
          rosterNames={rosterNames}
          recentNames={recentNames}
          inputRef={inputRef}
          onAddPermanent={handleAddPermanent}
          onAddTemporary={onAddTemporary}
          onToggleCrossOut={onToggleCrossOut}
        />

        {mode === 'temporary' && visibleRecent.length > 0 ? (
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

        {mode === 'permanent' && reenterableRosterOfficers.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Roster officers to re-enter</p>
            <div className="flex flex-wrap gap-1.5">
              {reenterableRosterOfficers.slice(0, MAX_VISIBLE_RECENT_CHIPS).map((item) => (
                <RosterChip
                  key={item.name}
                  name={item.name}
                  isCrossedOut={item.isCrossedOut}
                  onAction={() => {
                    if (item.existing && item.isCrossedOut) {
                      onToggleCrossOut(item.existing.id)
                    } else {
                      handleAddPermanent(item.name)
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <Separator />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
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
                onRemove={onRemove}
                onAddClick={() => {
                  setMode('permanent')
                  inputRef.current?.focus()
                }}
              />
              <OfficerGroup
                title="Temporary"
                officers={temporary}
                selectedOfficerId={selectedOfficerId}
                onSelect={onSelect}
                onToggleCrossOut={onToggleCrossOut}
                onRename={onRename}
                onRemove={onRemove}
                onAddClick={() => {
                  setMode('temporary')
                  inputRef.current?.focus()
                }}
              />
            </div>
          </ScrollArea>

          <DragOverlay dropAnimation={null}>
            {activeOfficer ? (
              <div className="flex items-center gap-2 rounded-md border bg-card p-2 shadow-xl ring-2 ring-primary/40 cursor-grabbing pointer-events-none select-none opacity-95">
                <span className="p-1 text-muted-foreground">
                  <GripVertical className="size-4" aria-hidden />
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold',
                    activeOfficer.crossedOut && 'line-through',
                  )}
                >
                  {initials(activeOfficer.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{activeOfficer.name}</p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
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
  onAddClick,
}: {
  title: string
  officers: Officer[]
  selectedOfficerId: string | null
  onSelect: (officerId: string) => void
  onToggleCrossOut: (officerId: string) => void
  onRename: (officerId: string, name: string) => void
  onRemove?: (officerId: string) => void
  onAddClick?: () => void
}) {
  if (officers.length === 0) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{title}</p>
          {onAddClick ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddClick}
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              + New
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">None yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          {title} · {officers.length}
        </p>
        {onAddClick ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddClick}
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            + New
          </Button>
        ) : null}
      </div>
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
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card p-2',
        isDragging && 'opacity-30 border-dashed border-primary/50 bg-muted/40',
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
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <Badge
            variant={officer.kind === 'permanent' ? 'secondary' : 'outline'}
            className="px-1 py-0 text-[10px]"
          >
            {officer.kind === 'permanent' ? 'Permanent' : 'Temporary'}
          </Badge>
          {officer.crossedOut ? (
            <Badge variant="outline" className="border-amber-500/50 px-1 py-0 text-[10px] text-amber-600 dark:text-amber-400">
              Left out of table
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCrossOut}
              aria-label={officer.crossedOut ? `Restore ${officer.name}` : `Cross out ${officer.name}`}
              className={officer.crossedOut ? 'text-primary hover:text-primary hover:bg-primary/10' : ''}
            >
              {officer.crossedOut ? (
                <Undo2 className="size-4" aria-hidden />
              ) : (
                <span className="text-sm leading-none" aria-hidden>✕</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {officer.crossedOut
              ? `Put ${officer.name} back in the table and exports`
              : `Leave ${officer.name} out of the table and exports for this month`}
          </TooltipContent>
        </Tooltip>

        {onRemove ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRemove}
                aria-label={`Remove ${officer.name}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove {officer.name} from this month</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}

function AddOfficer({
  mode,
  onModeChange,
  officers,
  rosterNames,
  recentNames,
  inputRef,
  onAddPermanent,
  onAddTemporary,
  onToggleCrossOut,
}: {
  mode: 'permanent' | 'temporary'
  onModeChange: (mode: 'permanent' | 'temporary') => void
  officers: Officer[]
  rosterNames: string[]
  recentNames: string[]
  inputRef: React.RefObject<HTMLInputElement | null>
  onAddPermanent: (name: string) => void
  onAddTemporary: (name: string) => void
  onToggleCrossOut: (officerId: string) => void
}) {
  const [value, setValue] = useState('')
  const [recentOpen, setRecentOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const trimmed = value.trim()

  const existingOfficersMap = new Map(
    officers.map((officer) => [officer.name.trim().toLowerCase(), officer]),
  )
  const matchedOfficer = trimmed !== '' ? existingOfficersMap.get(trimmed.toLowerCase()) : undefined

  // Suggestions for Temporary mode: recent names not already in this month
  const recentSuggestions = recentNames.filter(
    (name) => !existingOfficersMap.has(name.trim().toLowerCase()),
  )

  // Suggestions for Permanent mode: roster names from Settings
  const rosterItems = rosterNames.map((name) => {
    const existing = existingOfficersMap.get(name.trim().toLowerCase())
    return {
      name,
      existing,
      isCrossedOut: existing?.crossedOut === true,
      isInTable: existing !== undefined && !existing.crossedOut,
    }
  })

  function submit() {
    if (trimmed === '') return
    if (matchedOfficer) {
      if (matchedOfficer.crossedOut) {
        onToggleCrossOut(matchedOfficer.id)
        setValue('')
        return
      }
      return
    }

    if (mode === 'permanent') {
      onAddPermanent(trimmed)
    } else {
      onAddTemporary(trimmed)
    }
    setValue('')
    setRecentOpen(false)
    setRosterOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-1">
        <label htmlFor="add-officer-input" className="text-xs font-medium text-muted-foreground">
          Add {mode === 'permanent' ? 'a permanent' : 'a temporary'} officer
        </label>
        <div className="inline-flex rounded-md bg-muted p-0.5 text-xs" role="tablist" aria-label="Officer type">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'permanent'}
            onClick={() => {
              onModeChange('permanent')
              inputRef.current?.focus()
            }}
            className={cn(
              'rounded px-2 py-0.5 font-medium transition-colors cursor-pointer',
              mode === 'permanent'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Permanent
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'temporary'}
            onClick={() => {
              onModeChange('temporary')
              inputRef.current?.focus()
            }}
            className={cn(
              'rounded px-2 py-0.5 font-medium transition-colors cursor-pointer',
              mode === 'temporary'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Temporary
          </button>
        </div>
      </div>

      <Input
        id="add-officer-input"
        ref={inputRef}
        value={value}
        placeholder="Name, then press Enter"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
        className="h-9 w-full"
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={submit}
          disabled={trimmed === '' || (matchedOfficer !== undefined && !matchedOfficer.crossedOut)}
          className="flex-1"
        >
          <UserRoundPlus className="size-4" />
          Add
        </Button>

        {mode === 'permanent' ? (
          <Popover open={rosterOpen} onOpenChange={setRosterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Browse roster names">
                Roster
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search roster names" value={value} onValueChange={setValue} />
                <CommandList>
                  {rosterItems.length === 0 ? (
                    <CommandEmpty>No roster names in Settings.</CommandEmpty>
                  ) : (
                    <CommandGroup heading="Permanent Roster">
                      {rosterItems.map((item) => (
                        <CommandItem
                          key={item.name}
                          value={item.name}
                          onSelect={() => {
                            if (item.existing) {
                              if (item.isCrossedOut) {
                                onToggleCrossOut(item.existing.id)
                              }
                            } else {
                              onAddPermanent(item.name)
                            }
                            setValue('')
                            setRosterOpen(false)
                          }}
                        >
                          <span className="flex-1 truncate">{item.name}</span>
                          {item.isCrossedOut ? (
                            <Badge variant="outline" className="border-amber-500/50 text-[10px] text-amber-600 dark:text-amber-400">
                              Restore
                            </Badge>
                          ) : item.isInTable ? (
                            <Badge variant="secondary" className="text-[10px]">
                              In table
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              + Add
                            </Badge>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Popover open={recentOpen} onOpenChange={setRecentOpen}>
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
                    {recentSuggestions.map((name) => (
                      <CommandItem
                        key={name}
                        value={name}
                        onSelect={() => {
                          onAddTemporary(name)
                          setValue('')
                          setRecentOpen(false)
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
        )}
      </div>

      {matchedOfficer ? (
        matchedOfficer.crossedOut ? (
          <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
            <span className="truncate pr-1">
              {matchedOfficer.name} is crossed out for this month.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 shrink-0 px-2 text-xs"
              onClick={() => {
                onToggleCrossOut(matchedOfficer.id)
                setValue('')
              }}
            >
              <Undo2 className="size-3 mr-1" />
              Restore
            </Button>
          </div>
        ) : (
          <p className="text-xs text-destructive">
            {matchedOfficer.name} is already in this month&apos;s list.
          </p>
        )
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

function RosterChip({
  name,
  isCrossedOut,
  onAction,
}: {
  name: string
  isCrossedOut: boolean
  onAction: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAction}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        isCrossedOut
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200'
          : 'bg-secondary hover:bg-secondary/80',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
      title={isCrossedOut ? `Restore ${name} to table` : `Add ${name} to this month`}
    >
      <span>{name}</span>
      <span className="text-muted-foreground text-[10px]">
        {isCrossedOut ? '↩' : '+'}
      </span>
    </button>
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

import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CopyPlus,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface ActivitiesTabProps {
  activities: string[]
  previousMonthLabel: string
  previousMonthHasList: boolean
  onAdd: (text: string) => void
  onUpdate: (index: number, text: string) => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
  onSwap?: (from: number, to: number) => void
  onSave?: (activities: string[]) => void
  onCopyPrevious: () => void
  className?: string
}

interface ActivityDraftItem {
  id: string
  text: string
}

function createDraftItems(list: string[]): ActivityDraftItem[] {
  return list.map((text, idx) => ({
    id: `act-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    text,
  }))
}

export function ActivitiesTab({
  activities,
  previousMonthLabel,
  previousMonthHasList,
  onAdd,
  onUpdate,
  onRemove: _onRemove,
  onMove: _onMove,
  onSwap,
  onSave,
  onCopyPrevious,
  className,
}: ActivitiesTabProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [items, setItems] = useState<ActivityDraftItem[]>(() => createDraftItems(activities))
  const [activeId, setActiveId] = useState<string | null>(null)

  // Track external updates to the activities prop (e.g. month navigation or copy previous)
  const lastSyncedActivitiesRef = useRef<string[]>(activities)
  useEffect(() => {
    // Check if activities prop differs from last synced
    const prev = lastSyncedActivitiesRef.current
    const isDifferent =
      prev.length !== activities.length || prev.some((val, i) => val !== activities[i])

    if (isDifferent) {
      lastSyncedActivitiesRef.current = activities
      setItems(createDraftItems(activities))
    }
  }, [activities])

  // Determine if there are unconfirmed changes
  const currentTexts = useMemo(() => items.map((i) => i.text), [items])
  const isDirty = useMemo(() => {
    if (currentTexts.length !== activities.length) return true
    return currentTexts.some((text, idx) => text !== activities[idx])
  }, [currentTexts, activities])

  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  const itemsRef = useRef(items)
  itemsRef.current = items

  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  // Auto-save on unmount if there are unconfirmed changes so user navigating to Preview doesn't lose them
  useEffect(() => {
    return () => {
      if (isDirtyRef.current && onSaveRef.current) {
        const finalTexts = itemsRef.current
          .map((i) => i.text.trim())
          .filter((t) => t.length > 0)
        onSaveRef.current(finalTexts)
      }
    }
  }, [])

  const activeIndex = useMemo(() => {
    if (!activeId) return null
    const idx = items.findIndex((i) => i.id === activeId)
    return idx === -1 ? null : idx
  }, [activeId, items])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const fromIndex = items.findIndex((item) => item.id === String(active.id))
    const toIndex = items.findIndex((item) => item.id === String(over.id))

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

    handleSwap(fromIndex, toIndex)
  }

  function handleSwap(fromIndex: number, toIndex: number) {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= items.length ||
      toIndex >= items.length
    ) {
      return
    }

    setItems((prev) => {
      const next = [...prev]
      const fromItem = next[fromIndex]
      const toItem = next[toIndex]
      if (fromItem && toItem) {
        next[fromIndex] = toItem
        next[toIndex] = fromItem
      }
      return next
    })

    if (onSwap) {
      onSwap(fromIndex, toIndex)
    }
  }

  function handleUpdateText(index: number, newText: string) {
    setItems((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = { ...next[index], text: newText }
      }
      return next
    })
  }

  function handleConfirmRow(index: number) {
    const finalTexts = items.map((i) => i.text.trim()).filter((t) => t.length > 0)
    if (onSave) {
      onSave(finalTexts)
      lastSyncedActivitiesRef.current = finalTexts
    } else {
      onUpdate(index, items[index]?.text ?? '')
    }
    toast.success(`Activity ${index + 1} confirmed and updated.`)
  }

  function handleRevertRow(index: number) {
    setItems((prev) => {
      const next = [...prev]
      if (next[index] && activities[index] !== undefined) {
        next[index] = { ...next[index], text: activities[index] }
      }
      return next
    })
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleConfirmAll() {
    const finalTexts = items.map((i) => i.text.trim()).filter((t) => t.length > 0)
    if (onSave) {
      onSave(finalTexts)
      lastSyncedActivitiesRef.current = finalTexts
    } else {
      // Fallback if onSave prop not provided
      finalTexts.forEach((text, idx) => {
        if (activities[idx] !== text) {
          onUpdate(idx, text)
        }
      })
    }
    toast.success('Activities confirmed and updated.')
  }

  function handleDiscardAll() {
    setItems(createDraftItems(activities))
    toast.info('Changes discarded.')
  }

  function handleAddNew(text: string) {
    const newItem: ActivityDraftItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
    }
    setItems((prev) => [...prev, newItem])
    onAdd(text)
  }

  return (
    <Card className={cn('flex h-full w-full flex-col min-h-0', className)}>
      <CardHeader className="shrink-0 flex-row flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <CardTitle className="text-base font-bold">
            Activities <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
          </CardTitle>
          {isDirty ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs">
              Unsaved changes
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {isDirty ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardAll}
                className="h-8 text-xs font-medium"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmAll}
                className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Check className="size-3.5" />
                Confirm Changes
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-8 text-xs gap-1.5 text-muted-foreground opacity-70"
            >
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Changes Confirmed
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onCopyPrevious}
            disabled={!previousMonthHasList}
            className="h-8 text-xs gap-1.5"
          >
            <CopyPlus className="size-3.5" />
            Copy from {previousMonthLabel}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-3">
        {items.length === 0 ? (
          <p className="shrink-0 text-sm text-muted-foreground">
            This month has no activity list yet. Add the monitoring tasks below, or copy the list from{' '}
            {previousMonthLabel}.
          </p>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <ScrollArea className="min-h-0 flex-1 pr-1">
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="space-y-1.5 pr-2">
                {items.map((item, index) => (
                  <li key={item.id}>
                    <ActivityRow
                      id={item.id}
                      index={index}
                      total={items.length}
                      items={items}
                      value={item.text}
                      originalValue={activities[index] ?? ''}
                      activeId={activeId}
                      onChange={(text) => handleUpdateText(index, text)}
                      onConfirmRow={() => handleConfirmRow(index)}
                      onRevertRow={() => handleRevertRow(index)}
                      onRemove={() => handleRemoveItem(index)}
                      onSwap={handleSwap}
                    />
                  </li>
                ))}
              </ol>
            </SortableContext>
          </ScrollArea>

          <DragOverlay dropAnimation={null}>
            {activeIndex !== null && items[activeIndex] !== undefined ? (
              <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-card p-2 shadow-2xl ring-2 ring-primary/40 cursor-grabbing pointer-events-none select-none opacity-95">
                <span className="p-1 text-muted-foreground">
                  <GripVertical className="size-4" aria-hidden />
                </span>
                <span className="w-7 shrink-0 text-center text-sm font-bold text-primary tabular-nums">
                  {activeIndex + 1}.
                </span>
                <p className="truncate text-sm font-medium">{items[activeIndex].text}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="shrink-0 pt-1">
          <NewActivityInput onAdd={handleAddNew} />
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityRow({
  id,
  index,
  total,
  items,
  value,
  originalValue,
  activeId,
  onChange,
  onConfirmRow,
  onRevertRow,
  onRemove,
  onSwap,
}: {
  id: string
  index: number
  total: number
  items: ActivityDraftItem[]
  value: string
  originalValue: string
  activeId: string | null
  onChange: (text: string) => void
  onConfirmRow: () => void
  onRevertRow: () => void
  onRemove: () => void
  onSwap: (from: number, to: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id })

  const isRowModified = value !== originalValue
  const isTargetSwap = isOver && activeId !== null && activeId !== id
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Only apply transform to the dragging item so other items don't shift around
  const style = isDragging
    ? { transform: CSS.Translate.toString(transform), transition }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card p-2 transition-colors relative',
        isDragging && 'opacity-30 border-dashed border-primary/50 bg-muted/40',
        isTargetSwap && 'ring-2 ring-primary border-primary bg-primary/10 shadow-sm',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder activity ${index + 1}`}
        className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      {/* Interactive position number: clicking allows directly swapping with any other position */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-7 h-7 shrink-0 rounded text-center text-sm font-semibold tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors cursor-pointer"
            title={`Position ${index + 1}. Click to swap with another position`}
            aria-label={`Position ${index + 1}. Click to swap with another position`}
          >
            {index + 1}.
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-2.5">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">Swap position #{index + 1}</p>
              <p className="text-[11px] text-muted-foreground">
                Select a position to exchange places with activity #{index + 1}:
              </p>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {Array.from({ length: total }, (_, i) => {
                if (i === index) return null
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onSwap(index, i)
                      setPopoverOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted transition-colors cursor-pointer"
                  >
                    <span className="w-5 shrink-0 font-bold text-primary tabular-nums">
                      #{i + 1}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {items[i]?.text ?? `Activity ${i + 1}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onConfirmRow()
          }
        }}
        aria-label={`Activity ${index + 1}`}
        className={cn(
          'h-8 text-sm transition-colors',
          isRowModified && 'border-amber-500/70 focus-visible:ring-amber-500/40 bg-amber-500/5',
        )}
      />

      {isTargetSwap ? (
        <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary px-1.5 py-0.5 rounded bg-primary/10">
          <ArrowUpDown className="size-3" />
          Swap with this
        </span>
      ) : null}

      <div className="flex shrink-0 items-center gap-0.5">
        {/* Row-level confirm and revert buttons shown when row is edited */}
        {isRowModified ? (
          <>
            <Button
              variant="default"
              size="icon-sm"
              onClick={onConfirmRow}
              aria-label={`Confirm changes for activity ${index + 1}`}
              title="Confirm changes (Enter)"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRevertRow}
              aria-label={`Revert changes for activity ${index + 1}`}
              title="Revert edit"
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </>
        ) : null}

        {/* Up arrow to swap with previous */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onSwap(index, index - 1)}
          disabled={index === 0}
          aria-label={`Move activity ${index + 1} up`}
          title="Move up"
        >
          <ArrowUp className="size-3.5" />
        </Button>

        {/* Down arrow to swap with next */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onSwap(index, index + 1)}
          disabled={index === total - 1}
          aria-label={`Move activity ${index + 1} down`}
          title="Move down"
        >
          <ArrowDown className="size-3.5" />
        </Button>

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Delete activity ${index + 1}`}
          title="Delete activity"
          className="hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function NewActivityInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState('')

  function submit() {
    const text = value.trim()
    if (text === '') return
    onAdd(text)
    setValue('')
  }

  return (
    <div className="flex gap-1.5">
      <Input
        value={value}
        placeholder="Add another monitoring activity"
        aria-label="New activity"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
        className="h-9"
      />
      <Button size="sm" onClick={submit} disabled={value.trim() === ''}>
        <Plus className="size-4" />
        Add
      </Button>
    </div>
  )
}

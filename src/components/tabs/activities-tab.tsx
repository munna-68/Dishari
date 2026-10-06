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
import { ArrowDown, ArrowUp, CopyPlus, GripVertical, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  onCopyPrevious: () => void
  className?: string
}

export function ActivitiesTab({
  activities,
  previousMonthLabel,
  previousMonthHasList,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onCopyPrevious,
  className,
}: ActivitiesTabProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return
    const from = Number(String(event.active.id).replace('activity-', ''))
    const to = Number(String(event.over.id).replace('activity-', ''))
    if (Number.isNaN(from) || Number.isNaN(to) || from === to) return
    onMove(from, to)
  }

  return (
    <Card className={cn('flex h-full w-full flex-col min-h-0', className)}>
      <CardHeader className="shrink-0 flex-row flex-wrap items-center justify-between gap-2 px-4 py-3">
        <CardTitle className="text-base">
          Activities <span className="text-sm font-normal text-muted-foreground">({activities.length})</span>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onCopyPrevious} disabled={!previousMonthHasList}>
          <CopyPlus />
          Copy from {previousMonthLabel}
        </Button>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
        {activities.length === 0 ? (
          <p className="shrink-0 text-sm text-muted-foreground">
            This month has no activity list yet. Add the monitoring tasks below, or copy the list from{' '}
            {previousMonthLabel}.
          </p>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <ScrollArea className="min-h-0 flex-1 pr-1">
            <SortableContext
              items={activities.map((_, index) => `activity-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="space-y-1.5 pr-2">
                {activities.map((activity, index) => (
                  <li key={`activity-${index}`}>
                    <ActivityRow
                      index={index}
                      total={activities.length}
                      value={activity}
                      onChange={(text) => onUpdate(index, text)}
                      onRemove={() => onRemove(index)}
                      onMoveTo={(to) => onMove(index, to)}
                    />
                  </li>
                ))}
              </ol>
            </SortableContext>
          </ScrollArea>
        </DndContext>

        <div className="shrink-0 pt-1">
          <NewActivityInput onAdd={onAdd} />
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityRow({
  index,
  total,
  value,
  onChange,
  onRemove,
  onMoveTo,
}: {
  index: number
  total: number
  value: string
  onChange: (text: string) => void
  onRemove: () => void
  onMoveTo: (to: number) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: `activity-${index}` })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card p-2',
        isDragging && 'z-10 opacity-70 shadow-md',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder activity ${index + 1}`}
        className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <span aria-hidden className="w-5 shrink-0 text-right text-sm font-semibold text-muted-foreground tabular-nums">
        {index + 1}.
      </span>

      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`Activity ${index + 1}`}
        className="h-8"
      />

      <div className="flex shrink-0 items-center gap-0.5">
        {/* Keyboard and non-drag alternatives to reordering. */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMoveTo(index - 1)}
          disabled={index === 0}
          aria-label={`Move activity ${index + 1} up`}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMoveTo(index + 1)}
          disabled={index === total - 1}
          aria-label={`Move activity ${index + 1} down`}
        >
          <ArrowDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Delete activity ${index + 1}`}
        >
          <Trash2 />
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
        <Plus />
        Add
      </Button>
    </div>
  )
}

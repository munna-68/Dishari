import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PlannerCalendar } from './planner-calendar'
import type { MonthSchedule } from '@/lib/schema'
import { emptyHolidayContext } from '@/lib/working-days'

describe('PlannerCalendar band segmentation', () => {
  const dummyContext = emptyHolidayContext([5, 6])

  const dummySchedule: MonthSchedule = {
    schemaVersion: 1,
    year: 2026,
    month: 10,
    windows: {
      one: { start: '2026-10-01', end: '2026-10-14' },
      two: { start: '2026-10-15', end: '2026-10-27' },
    },
    activities: [],
    officers: [],
    assignments: {},
  }

  it('renders window bands with segmented day columns and gaps', () => {
    const { container } = render(
      <TooltipProvider>
        <PlannerCalendar
          monthKey="2026-10"
          context={dummyContext}
          windows={dummySchedule.windows}
          schedule={dummySchedule}
          selectedOfficerId={null}
          onToggleDay={vi.fn()}
          onMoveWindowEdge={vi.fn()}
          onShiftWindow={vi.fn()}
        />
      </TooltipProvider>,
    )

    // Locate the draggable window body elements
    const windowOneBody = container.querySelector('[aria-label*="Window 1: 2026-10-01 to 2026-10-14"]')
    expect(windowOneBody).toBeInTheDocument()

    // It should have grid and gap-1 classes
    expect(windowOneBody).toHaveClass('grid', 'gap-1')

    // Find all window body segments rendered across weeks
    const allWindowBodies = container.querySelectorAll('[role="button"][aria-label*="Drag to shift this window."]')
    expect(allWindowBodies.length).toBeGreaterThan(0)

    // Check that each window body has multiple child segment spans corresponding to dates in that week
    for (const body of allWindowBodies) {
      const childSpans = body.querySelectorAll('span.rounded-full')
      expect(childSpans.length).toBeGreaterThan(0)
    }

    // Verify day cell does not have the old static top window stripe
    const staticStripes = container.querySelectorAll('.pointer-events-none.absolute.inset-x-0.top-0.h-1')
    expect(staticStripes.length).toBe(0)
  })
})

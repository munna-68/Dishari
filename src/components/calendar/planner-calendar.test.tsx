import { fireEvent, render, screen } from '@testing-library/react'
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

  it('renders weekly off days grayed out with bg-weekend even when inside visit window', () => {
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

    // 2026-10-02 is Friday (weekly-off) and falls within Window 1 (2026-10-01 to 2026-10-14)
    const offDayInWindow = container.querySelector('[data-date="2026-10-02"]')
    expect(offDayInWindow).toBeInTheDocument()
    expect(offDayInWindow).toHaveClass('bg-weekend', 'offday-hatch', 'text-muted-foreground')
    expect(offDayInWindow).not.toHaveClass('bg-window-one-soft/50')

    // 2026-10-01 is Thursday (working day) in Window 1
    const workingDayInWindow = container.querySelector('[data-date="2026-10-01"]')
    expect(workingDayInWindow).toBeInTheDocument()
    expect(workingDayInWindow).toHaveClass('bg-window-one-soft/50')
    expect(workingDayInWindow).not.toHaveClass('bg-weekend')

    // 2026-10-30 is Friday (weekly-off) outside any window
    const offDayOutsideWindow = container.querySelector('[data-date="2026-10-30"]')
    expect(offDayOutsideWindow).toBeInTheDocument()
    expect(offDayOutsideWindow).toHaveClass('bg-weekend', 'offday-hatch', 'text-muted-foreground')
  })
})

describe('PlannerCalendar officer assignments & Google Calendar modal', () => {
  const dummyContext = emptyHolidayContext([5, 6])

  const scheduleWithOfficers: MonthSchedule = {
    schemaVersion: 2,
    year: 2026,
    month: 10,
    windows: {
      one: { start: '2026-10-04', end: '2026-10-13' },
      two: { start: '2026-10-14', end: '2026-10-27' },
    },
    activities: [],
    officers: [
      { id: 'off-1', name: 'Moyen Uddin', kind: 'permanent', crossedOut: false },
      { id: 'off-2', name: 'Md. Nuruzzaman', kind: 'permanent', crossedOut: false },
    ],
    assignments: {
      'off-1': {
        one: { branch: 'Lalmonirhat', customRanges: [] },
        two: { branch: 'Kurigram', customRanges: [] },
      },
      'off-2': {
        one: { branch: 'Rangpur', customRanges: [] },
        two: { branch: 'Dinajpur', customRanges: [] },
      },
    },
  }

  it('renders officer name and branch on day cells during visit windows', () => {
    const { container } = render(
      <TooltipProvider>
        <PlannerCalendar
          monthKey="2026-10"
          context={dummyContext}
          windows={scheduleWithOfficers.windows}
          schedule={scheduleWithOfficers}
          selectedOfficerId={null}
          onToggleDay={vi.fn()}
          onMoveWindowEdge={vi.fn()}
          onShiftWindow={vi.fn()}
        />
      </TooltipProvider>,
    )

    // 2026-10-04 is Sunday (working day) within Window 1
    const cellOct4 = container.querySelector('[data-date="2026-10-04"]')
    expect(cellOct4).toBeInTheDocument()
    expect(cellOct4).toHaveTextContent('Moyen Uddin')
    expect(cellOct4).toHaveTextContent('Lalmonirhat')
    expect(cellOct4).toHaveTextContent('Md. Nuruzzaman')
    expect(cellOct4).toHaveTextContent('Rangpur')
  })

  it('clicking a day cell opens the details modal with editable information', () => {
    const onSetBranch = vi.fn()
    const onToggleDay = vi.fn()

    const { container } = render(
      <TooltipProvider>
        <PlannerCalendar
          monthKey="2026-10"
          context={dummyContext}
          windows={scheduleWithOfficers.windows}
          schedule={scheduleWithOfficers}
          selectedOfficerId={null}
          onToggleDay={onToggleDay}
          onMoveWindowEdge={vi.fn()}
          onShiftWindow={vi.fn()}
          onSetBranch={onSetBranch}
        />
      </TooltipProvider>,
    )

    // Click on 2026-10-04 cell
    const cellOct4 = container.querySelector('[data-date="2026-10-04"]') as HTMLElement
    expect(cellOct4).toBeInTheDocument()
    fireEvent.click(cellOct4)

    // Modal should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Sunday, 4 October 2026/i })).toBeInTheDocument()
    expect(screen.getByText(/Officer Assignments/i)).toBeInTheDocument()

    // Check branch input for Moyen Uddin
    const moyenInput = screen.getByDisplayValue('Lalmonirhat')
    expect(moyenInput).toBeInTheDocument()

    // Edit branch
    fireEvent.change(moyenInput, { target: { value: 'Badarganj' } })
    expect(onSetBranch).toHaveBeenCalledWith('off-1', 'one', 'Badarganj')

    // Mark as holiday button inside modal
    const holidayBtn = screen.getByRole('button', { name: /Mark as Holiday/i })
    expect(holidayBtn).toBeInTheDocument()
    fireEvent.click(holidayBtn)
    expect(onToggleDay).toHaveBeenCalledWith('2026-10-04')
  })

  it('spotlights only the selected officer when selectedOfficerId is set', () => {
    const { container } = render(
      <TooltipProvider>
        <PlannerCalendar
          monthKey="2026-10"
          context={dummyContext}
          windows={scheduleWithOfficers.windows}
          schedule={scheduleWithOfficers}
          selectedOfficerId="off-1"
          onToggleDay={vi.fn()}
          onMoveWindowEdge={vi.fn()}
          onShiftWindow={vi.fn()}
        />
      </TooltipProvider>,
    )

    const cellOct4 = container.querySelector('[data-date="2026-10-04"]')
    expect(cellOct4).toBeInTheDocument()
    expect(cellOct4).toHaveTextContent('Moyen Uddin')
    expect(cellOct4).toHaveTextContent('Lalmonirhat')
    // Should NOT show off-2's branch directly
    expect(cellOct4).not.toHaveTextContent('Md. Nuruzzaman')
    expect(cellOct4).not.toHaveTextContent('Rangpur')
  })
})

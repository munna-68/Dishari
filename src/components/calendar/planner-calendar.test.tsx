import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DayCell } from './day-cell'
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

    // Window edge handles use proper horizontal slider thumb affordance and stay within row
    const edgeHandles = container.querySelectorAll('[aria-label*="Move the start of"], [aria-label*="Move the end of"]')
    expect(edgeHandles.length).toBeGreaterThan(0)
    for (const handle of edgeHandles) {
      expect(handle).toHaveClass('cursor-ew-resize')
      expect(handle).not.toHaveClass('-translate-y-1/2')
      const thumb = handle.querySelector('span.rounded-full')
      expect(thumb).toBeInTheDocument()
      expect(thumb).toHaveClass('shadow-xs')
    }
  })

  it('renders weekly off days and window band segments muted and desaturated inside visit window', () => {
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
    expect(offDayInWindow).toHaveClass('bg-window-one-muted-off', 'offday-hatch', 'text-muted-foreground')

    // 2026-10-01 is Thursday (working day) in Window 1
    const workingDayInWindow = container.querySelector('[data-date="2026-10-01"]')
    expect(workingDayInWindow).toBeInTheDocument()
    expect(workingDayInWindow).toHaveClass('bg-window-one-soft/50')

    // 2026-10-30 is Friday (weekly-off) outside any window
    const offDayOutsideWindow = container.querySelector('[data-date="2026-10-30"]')
    expect(offDayOutsideWindow).toBeInTheDocument()
    expect(offDayOutsideWindow).toHaveClass('bg-weekend', 'offday-hatch', 'text-muted-foreground')

    // Window band segments over off days have window-band-muted class
    const mutedBandSpans = container.querySelectorAll('.window-band-muted')
    expect(mutedBandSpans.length).toBeGreaterThan(0)
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
    activities: ['Verify loans at group level', 'Assess staff productivity'],
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

  it('renders clean day cells with an assignment indication pill and expand cue', () => {
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

    // The cell body is NOT crowded with full officer names
    expect(cellOct4).not.toHaveTextContent('Md. Nuruzzaman')

    // But it has a clear indication that 2 officers are scheduled
    expect(cellOct4).toHaveTextContent('2 officers')
  })

  it('clicking a day cell opens the details modal with editable information and navigation', () => {
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
    expect(screen.getByText(/Officers & Branches/i)).toBeInTheDocument()

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

    // Check monitoring tasks tab
    const tasksTab = screen.getByRole('tab', { name: /Monitoring Tasks/i })
    expect(tasksTab).toBeInTheDocument()
    fireEvent.click(tasksTab)
    expect(screen.getByText(/Verify loans at group level/i)).toBeInTheDocument()

    // Check next day navigation
    const nextDayBtn = screen.getByRole('button', { name: /Next day/i })
    expect(nextDayBtn).toBeInTheDocument()
    fireEvent.click(nextDayBtn)
    expect(screen.getByRole('heading', { name: /Monday, 5 October 2026/i })).toBeInTheDocument()
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
    expect(cellOct4).toHaveTextContent('Lalmonirhat')
    // Should NOT show off-2's branch directly
    expect(cellOct4).not.toHaveTextContent('Rangpur')
  })

  it('allows browsing and selecting branches via the chevron dropdown for any officer row', () => {
    const onSetBranch = vi.fn()

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
          onSetBranch={onSetBranch}
        />
      </TooltipProvider>,
    )

    // Open Oct 4 details
    const cellOct4 = container.querySelector('[data-date="2026-10-04"]') as HTMLElement
    fireEvent.click(cellOct4)

    // Find the dropdown chevron toggle for the 2nd officer (Md. Nuruzzaman)
    const browseButtons = screen.getAllByTitle('Browse branch options')
    expect(browseButtons.length).toBe(2)

    // Click dropdown for Md. Nuruzzaman (index 1)
    fireEvent.click(browseButtons[1]!)

    // Popover content should be open with Quick Actions
    expect(screen.getByText('+ Issue-Based Monitoring')).toBeInTheDocument()

    // Click "+ Issue-Based Monitoring"
    fireEvent.click(screen.getByText('+ Issue-Based Monitoring'))
    expect(onSetBranch).toHaveBeenCalledWith('off-2', 'one', 'Issue-Based Monitoring')
  })

  it('provides a prominent Done button in the header to close the modal', () => {
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

    // Open dialog
    const cellOct4 = container.querySelector('[data-date="2026-10-04"]') as HTMLElement
    fireEvent.click(cellOct4)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Header Done button
    const doneButton = screen.getByRole('button', { name: /^Done$/i })
    expect(doneButton).toBeInTheDocument()

    // Click Done button
    fireEvent.click(doneButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('toggles the Dates button between stages to show and hide custom date range inputs', () => {
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

    // Open dialog
    const cellOct4 = container.querySelector('[data-date="2026-10-04"]') as HTMLElement
    fireEvent.click(cellOct4)

    // Find Dates toggle buttons
    const datesButtons = screen.getAllByRole('button', { name: /Dates/i })
    expect(datesButtons.length).toBeGreaterThan(0)

    // Initially custom date inputs are hidden
    expect(screen.queryByText('Start date')).not.toBeInTheDocument()

    // Click Dates button (stage 1: toggle open)
    fireEvent.click(datesButtons[0]!)
    expect(screen.getByText('Start date')).toBeInTheDocument()
    expect(screen.getByText('End date')).toBeInTheDocument()

    // Click Dates button again (stage 2: toggle closed)
    fireEvent.click(datesButtons[0]!)
    expect(screen.queryByText('Start date')).not.toBeInTheDocument()
  })

  it('renders Today cell with clean inset styling without ring offset gap and places Today badge at top with date number', () => {
    const { container } = render(
      <TooltipProvider>
        <DayCell
          iso="2026-10-07"
          date={7}
          inMonth={true}
          status={{ kind: 'working' }}
          holidayName={null}
          bengaliName={null}
          isToday={true}
          inWindowOne={true}
          inWindowTwo={false}
          isOfficerRange={false}
          assignments={[]}
          onClick={vi.fn()}
        />
      </TooltipProvider>,
    )

    const cell = container.querySelector('[data-date="2026-10-07"]')
    expect(cell).toBeInTheDocument()

    // Must use ring-inset so that there is no offset gap between border and window bands
    expect(cell).toHaveClass('ring-inset')
    expect(cell).not.toHaveClass('ring-offset-1')
    expect(cell).not.toHaveClass('ring-offset-background')

    // Today badge must be in the top row alongside the date number
    const todayBadge = screen.getByText('Today')
    expect(todayBadge).toBeInTheDocument()
    expect(todayBadge).not.toHaveClass('bottom-1', 'right-1', 'absolute')

    // Top date container has both the date number and Today badge
    const topRow = cell?.firstElementChild
    expect(topRow).toHaveTextContent('7')
    expect(topRow).toHaveTextContent('Today')
  })
})

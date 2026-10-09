import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AssignmentsTab } from './assignments-tab'
import { defaultSettings } from '@/lib/schema'
import { emptyHolidayContext } from '@/lib/working-days'
import type { MonthSchedule } from '@/lib/schema'

describe('AssignmentsTab - Fixed width layout and input experience', () => {
  const dummySchedule: MonthSchedule = {
    schemaVersion: 1,
    year: 2026,
    month: 10,
    windows: {
      one: { start: '2026-10-01', end: '2026-10-14' },
      two: { start: '2026-10-15', end: '2026-10-27' },
    },
    activities: ['Activity 1'],
    officers: [
      { id: 'off-1', name: 'Moyen Uddin', kind: 'permanent', crossedOut: false },
      { id: 'off-2', name: 'Jamir Uddin', kind: 'permanent', crossedOut: false },
    ],
    assignments: {
      'off-1': {
        one: { branch: 'Mangalpur, Dinajpur', customRanges: [] },
        two: { branch: 'Hatrampur, Dinajpur', customRanges: [] },
      },
      'off-2': {
        one: { branch: '', customRanges: [] },
        two: { branch: '', customRanges: [] },
      },
    },
  }

  const dummySettings = {
    ...defaultSettings(),
    recentBranchNames: ['Patgram Sadar, Lalmonirhat', 'Pirgonj, Rangpur'],
  }
  const dummyContext = emptyHolidayContext([5, 6])

  it('renders a table with table-fixed and fixed colgroup proportions', () => {
    const { container } = render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={dummySchedule}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={vi.fn()}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    const table = container.querySelector('table')
    expect(table).toHaveClass('table-fixed')

    const cols = container.querySelectorAll('colgroup col')
    expect(cols).toHaveLength(5)
    expect(cols[0]).toHaveClass('w-[15%]')
    expect(cols[1]).toHaveClass('w-[28%]')
    expect(cols[2]).toHaveClass('w-[14.5%]')
    expect(cols[3]).toHaveClass('w-[28%]')
    expect(cols[4]).toHaveClass('w-[14.5%]')
  })

  it('renders textarea inputs for branch names with auto-sizing support', () => {
    render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={dummySchedule}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={vi.fn()}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    const textareas = screen.getAllByRole('textbox')
    expect(textareas.length).toBeGreaterThanOrEqual(2)
    expect(textareas[0]).toHaveValue('Mangalpur, Dinajpur')
    expect(textareas[0]?.tagName.toLowerCase()).toBe('textarea')
  })

  it('toggles Issue-Based Monitoring on click', () => {
    const onSetBranch = vi.fn()
    render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={dummySchedule}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={onSetBranch}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    // Button starts as "+ Issue-Based Monitoring" for Moyen Uddin window 1
    const addButtons = screen.getAllByRole('button', { name: /\+ Issue-Based Monitoring/i })
    expect(addButtons.length).toBeGreaterThan(0)

    fireEvent.click(addButtons[0]!)
    expect(onSetBranch).toHaveBeenCalledWith(
      'off-1',
      'one',
      'Issue-Based Monitoring at Mangalpur, Dinajpur',
    )
  })

  it('toggles off Issue-Based Monitoring when already present', () => {
    const onSetBranch = vi.fn()
    const scheduleWithMonitoring: MonthSchedule = {
      ...dummySchedule,
      assignments: {
        ...dummySchedule.assignments,
        'off-1': {
          one: { branch: 'Issue-Based Monitoring at Mangalpur, Dinajpur', customRanges: [] },
          two: { branch: 'Hatrampur, Dinajpur', customRanges: [] },
        },
      },
    }

    render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={scheduleWithMonitoring}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={onSetBranch}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    // Button should display "- Issue-Based Monitoring"
    const removeButton = screen.getByRole('button', { name: /- Issue-Based Monitoring/i })
    expect(removeButton).toBeInTheDocument()

    fireEvent.click(removeButton)
    expect(onSetBranch).toHaveBeenCalledWith(
      'off-1',
      'one',
      'Mangalpur, Dinajpur',
    )
  })

  it('toggles Special Visit at as a prefix before branch name', () => {
    const onSetBranch = vi.fn()
    render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={dummySchedule}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={onSetBranch}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    const addSpecialButtons = screen.getAllByRole('button', { name: /\+ Special Visit at/i })
    expect(addSpecialButtons.length).toBeGreaterThan(0)

    fireEvent.click(addSpecialButtons[0]!)
    expect(onSetBranch).toHaveBeenCalledWith(
      'off-1',
      'one',
      'Special Visit at Mangalpur, Dinajpur',
    )
  })

  it('toggles off Special Visit at when already present', () => {
    const onSetBranch = vi.fn()
    const scheduleWithSpecial: MonthSchedule = {
      ...dummySchedule,
      assignments: {
        ...dummySchedule.assignments,
        'off-1': {
          one: { branch: 'Special Visit at Mangalpur, Dinajpur', customRanges: [] },
          two: { branch: 'Hatrampur, Dinajpur', customRanges: [] },
        },
      },
    }

    render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={scheduleWithSpecial}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={onSetBranch}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    const removeButton = screen.getByRole('button', { name: /- Special Visit at/i })
    expect(removeButton).toBeInTheDocument()

    fireEvent.click(removeButton)
    expect(onSetBranch).toHaveBeenCalledWith(
      'off-1',
      'one',
      'Mangalpur, Dinajpur',
    )
  })

  it('cleans up legacy suffix format when toggled off', () => {
    const onSetBranch = vi.fn()
    const scheduleWithLegacy: MonthSchedule = {
      ...dummySchedule,
      assignments: {
        ...dummySchedule.assignments,
        'off-1': {
          one: { branch: 'Mangalpur, Dinajpur Special Visit at', customRanges: [] },
          two: { branch: 'Hatrampur, Dinajpur', customRanges: [] },
        },
      },
    }

    render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={scheduleWithLegacy}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={onSetBranch}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    const removeButton = screen.getByRole('button', { name: /- Special Visit at/i })
    expect(removeButton).toBeInTheDocument()

    fireEvent.click(removeButton)
    expect(onSetBranch).toHaveBeenCalledWith(
      'off-1',
      'one',
      'Mangalpur, Dinajpur',
    )
  })

  it('allows clicking a "Seen before" suggestion to set the branch', () => {
    const onSetBranch = vi.fn()
    render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={dummySchedule}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={onSetBranch}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    const suggestionButton = screen.getAllByRole('button', { name: /Patgram Sadar, Lalmonirhat/i })[0]!
    fireEvent.click(suggestionButton)
    expect(onSetBranch).toHaveBeenCalledWith(
      'off-1',
      'one',
      'Patgram Sadar, Lalmonirhat',
    )
  })

  it('prevents newline on Enter key in branch textarea and triggers blur', () => {
    render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={dummySchedule}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={vi.fn()}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    const textarea = screen.getAllByRole('textbox')[0]!
    const blurSpy = vi.spyOn(textarea, 'blur')

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    expect(blurSpy).toHaveBeenCalled()
  })

  it('color-matches Window 1 (blue) and Window 2 (emerald) branch and date cells consistently', () => {
    const { container } = render(
      <TooltipProvider>
        <AssignmentsTab
          schedule={dummySchedule}
          settings={dummySettings}
          context={dummyContext}
          warnings={[]}
          selectedOfficerId={null}
          onSelectOfficer={vi.fn()}
          onSetBranch={vi.fn()}
          onSetCustomRanges={vi.fn()}
          onSwapBranches={vi.fn()}
          onRememberBranch={vi.fn()}
        />
      </TooltipProvider>,
    )

    // Table headers have window indicators
    expect(screen.getByText('Window 1 branch')).toBeInTheDocument()
    expect(screen.getByText('Window 2 branch')).toBeInTheDocument()

    // Window 1 branch cards (both filled and empty) have blue accent
    const allW1Cards = container.querySelectorAll('[aria-label="Branch for window 1"]')
    expect(allW1Cards.length).toBeGreaterThanOrEqual(2)
    allW1Cards.forEach((el) => {
      const card = el.closest('div.rounded-xl')
      expect(card).toHaveClass('border-l-blue-500')
      expect(card?.className).toContain('rgba(59,130,246')
    })

    // Window 2 branch cards (both filled and empty) have emerald accent
    const allW2Cards = container.querySelectorAll('[aria-label="Branch for window 2"]')
    expect(allW2Cards.length).toBeGreaterThanOrEqual(2)
    allW2Cards.forEach((el) => {
      const card = el.closest('div.rounded-xl')
      expect(card).toHaveClass('border-l-emerald-500')
      expect(card?.className).toContain('rgba(16,185,129')
    })

    // Window 1 dates card has blue background styling
    const dateCards = container.querySelectorAll('td div.rounded-xl')
    const w1DateCard = Array.from(dateCards).find((el) => el.className.includes('bg-[#f0f6ff]'))
    const w2DateCard = Array.from(dateCards).find((el) => el.className.includes('bg-[#edf7f4]'))

    expect(w1DateCard).toBeDefined()
    expect(w2DateCard).toBeDefined()
  })
})

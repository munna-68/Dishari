import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AssignmentsTab } from './assignments-tab'
import { ActivitiesTab } from './activities-tab'
import { HolidaysTab } from './holidays-tab'
import { PreviewTab } from './preview-tab'
import { defaultSettings } from '@/lib/schema'
import { emptyHolidayContext } from '@/lib/working-days'
import { buildDocumentModel } from '@/lib/document-model'
import type { MonthSchedule } from '@/lib/schema'

describe('Tabs Layout stability and fixed height styling', () => {
  afterEach(() => {
    cleanup()
  })

  const dummySchedule: MonthSchedule = {
    schemaVersion: 1,
    year: 2026,
    month: 10,
    windows: {
      one: { start: '2026-10-01', end: '2026-10-14' },
      two: { start: '2026-10-15', end: '2026-10-27' },
    },
    activities: ['Activity 1', 'Activity 2'],
    officers: [
      { id: 'off-1', name: 'Moyen Uddin', kind: 'permanent', crossedOut: false },
      { id: 'off-2', name: 'Jamir Uddin', kind: 'permanent', crossedOut: false },
    ],
    assignments: {},
  }

  const dummyContext = emptyHolidayContext([5, 6])
  const dummySettings = defaultSettings()
  const dummyHolidays = { schemaVersion: 1, holidays: {}, workingOverrides: {} }
  const dummyDocModel = buildDocumentModel({
    schedule: dummySchedule,
    settings: dummySettings,
    context: dummyContext,
  })

  it('AssignmentsTab renders with full height flex container and scrollable table with sticky header', () => {
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

    const card = container.querySelector('[data-slot="card"]')
    expect(card).toHaveClass('h-full', 'w-full', 'flex', 'flex-col')

    const tableWrapper = container.querySelector('.overflow-auto')
    expect(tableWrapper).toBeInTheDocument()
    expect(tableWrapper).toHaveClass('flex-1', 'min-h-0')

    const thead = container.querySelector('thead')
    expect(thead).toHaveClass('sticky', 'top-0')
  })

  it('ActivitiesTab renders with full height flex container and internal scroll area', () => {
    const { container } = render(
      <TooltipProvider>
        <ActivitiesTab
          activities={dummySchedule.activities}
          previousMonthLabel="September 2026"
          previousMonthHasList={false}
          onAdd={vi.fn()}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
          onMove={vi.fn()}
          onCopyPrevious={vi.fn()}
        />
      </TooltipProvider>,
    )

    const card = container.querySelector('[data-slot="card"]')
    expect(card).toHaveClass('h-full', 'w-full', 'flex', 'flex-col')
  })

  it('HolidaysTab renders with full height flex container and scrollable content area', () => {
    const { container } = render(
      <TooltipProvider>
        <HolidaysTab
          monthKey="2026-10"
          holidays={dummyHolidays}
          weeklyOffDays={[5, 6]}
          onImport={vi.fn()}
          onRemove={vi.fn()}
          onClearImportedInMonth={vi.fn()}
        />
      </TooltipProvider>,
    )

    const card = container.querySelector('[data-slot="card"]')
    expect(card).toHaveClass('h-full', 'w-full', 'flex', 'flex-col')
    const cardContent = container.querySelector('[data-slot="card-content"]')
    expect(cardContent).toHaveClass('overflow-y-auto', 'flex-1')
  })

  it('PreviewTab renders with full height flex container and scrollable paper preview area', () => {
    const { container } = render(
      <TooltipProvider>
        <PreviewTab
          model={dummyDocModel}
          isBusy={false}
          onExportPdf={vi.fn()}
          onExportDocx={vi.fn()}
        />
      </TooltipProvider>,
    )

    const root = container.firstElementChild
    expect(root).toHaveClass('h-full', 'w-full', 'flex', 'flex-col')
    const previewWrapper = container.querySelector('.overflow-auto')
    expect(previewWrapper).toBeInTheDocument()
    expect(previewWrapper).toHaveClass('flex-1', 'min-h-0')
  })
})

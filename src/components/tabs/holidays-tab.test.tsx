import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HolidaysTab } from './holidays-tab'
import { TooltipProvider } from '@/components/ui/tooltip'

describe('HolidaysTab fetch scope dropdown', () => {
  it('renders dropdown with This month, The whole year, and individual months', () => {
    const dummyHolidays = { schemaVersion: 1 as const, holidays: {}, workingOverrides: {} }

    render(
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

    // The trigger displays This month (October) initially
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent(/This month \(October\)/i)

    // The explanatory text mentions October 2026
    expect(screen.getByText(/The prompt asks for October 2026/i)).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HolidayImportDialog } from './holiday-import-dialog'

const SAMPLE_JSON = JSON.stringify({
  year: 2026,
  holidays: [
    { date: '2026-10-04', name: 'Durga Puja', nameBn: 'দুর্গাপূজা' },
    { date: '2026-10-25', name: 'Lakshmi Puja', nameBn: 'লক্ষ্মীপূজা' },
  ],
})

describe('HolidayImportDialog', () => {
  it('renders instructions at top and starts with an empty input field', () => {
    render(
      <HolidayImportDialog
        open={true}
        onOpenChange={vi.fn()}
        prompt="Find official holidays for October 2026."
        onApply={vi.fn()}
      />,
    )

    // Instructions at top
    expect(screen.getByText(/How to get the holiday JSON/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy prompt/i })).toBeInTheDocument()

    // Input field should be empty, not filled with instructions
    const textarea = screen.getByLabelText(/Holiday JSON to import/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('')

    // Review the list button should be disabled initially
    const reviewBtn = screen.getByRole('button', { name: /Review the list/i })
    expect(reviewBtn).toBeDisabled()

    // No confusing muted "Apply" button shown at this stage
    expect(screen.queryByRole('button', { name: /^Apply/i })).not.toBeInTheDocument()
  })

  it('clicking Review the list reveals the holidays and updates the button to Apply for 2 holidays', () => {
    const onApply = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <HolidayImportDialog
        open={true}
        onOpenChange={onOpenChange}
        prompt="Find official holidays for October 2026."
        onApply={onApply}
      />,
    )

    const textarea = screen.getByLabelText(/Holiday JSON to import/i)
    fireEvent.change(textarea, { target: { value: SAMPLE_JSON } })

    const reviewBtn = screen.getByRole('button', { name: /Review the list/i })
    expect(reviewBtn).toBeEnabled()

    // Click Review the list
    fireEvent.click(reviewBtn)

    // The reviewed list shows up
    expect(screen.getByText('Durga Puja')).toBeInTheDocument()
    expect(screen.getByText('দুর্গাপূজা')).toBeInTheDocument()
    expect(screen.getByText('Lakshmi Puja')).toBeInTheDocument()
    expect(screen.getByText('লক্ষ্মীপূজা')).toBeInTheDocument()

    // The footer button transitions to "Apply for 2 holidays"
    const applyBtn = screen.getByRole('button', { name: /Apply for 2 holidays/i })
    expect(applyBtn).toBeInTheDocument()
    expect(applyBtn).toBeEnabled()

    // Uncheck one holiday
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    fireEvent.click(checkboxes[0]!)

    // Now it updates to "Apply for 1 holiday"
    expect(screen.getByRole('button', { name: /Apply for 1 holiday/i })).toBeInTheDocument()

    // Click apply
    fireEvent.click(screen.getByRole('button', { name: /Apply for 1 holiday/i }))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ date: '2026-10-25', nameEn: 'Lakshmi Puja' }),
    ])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('editing textarea resets the reviewed list and switches button back to Review the list', () => {
    render(
      <HolidayImportDialog
        open={true}
        onOpenChange={vi.fn()}
        prompt="Find official holidays for October 2026."
        onApply={vi.fn()}
      />,
    )

    const textarea = screen.getByLabelText(/Holiday JSON to import/i)
    fireEvent.change(textarea, { target: { value: SAMPLE_JSON } })
    fireEvent.click(screen.getByRole('button', { name: /Review the list/i }))

    expect(screen.getByText('Durga Puja')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apply for 2 holidays/i })).toBeInTheDocument()

    // Modify text in textarea
    fireEvent.change(textarea, { target: { value: '{"year": 2026, "holidays": []}' } })

    // Button reverts to "Review the list"
    expect(screen.getByRole('button', { name: /Review the list/i })).toBeInTheDocument()
    expect(screen.queryByText('Durga Puja')).not.toBeInTheDocument()
  })

  it('shows error state when invalid JSON is reviewed and keeps apply disabled', () => {
    render(
      <HolidayImportDialog
        open={true}
        onOpenChange={vi.fn()}
        prompt="Find official holidays."
        onApply={vi.fn()}
      />,
    )

    const textarea = screen.getByLabelText(/Holiday JSON to import/i)
    fireEvent.change(textarea, { target: { value: 'not valid json at all' } })
    fireEvent.click(screen.getByRole('button', { name: /Review the list/i }))

    expect(screen.getByText(/could not be read and will be skipped/i)).toBeInTheDocument()
    expect(screen.getByText(/No valid holidays found/i)).toBeInTheDocument()

    const applyBtn = screen.getByRole('button', { name: /Apply holidays/i })
    expect(applyBtn).toBeDisabled()
  })
})

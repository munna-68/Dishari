import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActivitiesTab } from './activities-tab'
import { TooltipProvider } from '@/components/ui/tooltip'

const sampleActivities = [
  'Observe the status of savings collections and refunds.',
  'Verify loans and savings at the group level.',
  'Verify the loan disbursement and documentation process.',
  'Assess staff productivity.',
  'Observe follow-up activities on the loan ceiling and overdue loans.',
]

function renderActivitiesTab(props: Partial<Parameters<typeof ActivitiesTab>[0]> = {}) {
  const onAdd = vi.fn()
  const onUpdate = vi.fn()
  const onRemove = vi.fn()
  const onMove = vi.fn()
  const onSwap = vi.fn()
  const onSave = vi.fn()
  const onCopyPrevious = vi.fn()

  const rendered = render(
    <TooltipProvider>
      <ActivitiesTab
        activities={sampleActivities}
        previousMonthLabel="September 2026"
        previousMonthHasList={true}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onMove={onMove}
        onSwap={onSwap}
        onSave={onSave}
        onCopyPrevious={onCopyPrevious}
        {...props}
      />
    </TooltipProvider>,
  )

  return {
    ...rendered,
    onAdd,
    onUpdate,
    onRemove,
    onMove,
    onSwap,
    onSave,
    onCopyPrevious,
  }
}

describe('ActivitiesTab swapping, replacing, and confirming changes', () => {
  it('renders all activities with position numbers and inputs', () => {
    renderActivitiesTab()

    // 5 activities rendered
    expect(screen.getByText('Activities')).toBeInTheDocument()
    expect(screen.getByText('(5)')).toBeInTheDocument()

    // Inputs have values
    const inputs = screen.getAllByRole('textbox')
    // First 5 are activities, last 1 is new activity input
    expect(inputs[0]).toHaveValue(sampleActivities[0])
    expect(inputs[1]).toHaveValue(sampleActivities[1])
    expect(inputs[2]).toHaveValue(sampleActivities[2])

    // Initially shows Changes Confirmed
    expect(screen.getByText('Changes Confirmed')).toBeInTheDocument()
  })

  it('clicking position badge allows swapping with another position (e.g. 3 with 1)', () => {
    const { onSave } = renderActivitiesTab()

    // Click position button 3 (Verify the loan disbursement...)
    const pos3Button = screen.getByRole('button', {
      name: 'Position 3. Click to swap with another position',
    })
    fireEvent.click(pos3Button)

    // Popover opens showing positions to swap with
    expect(screen.getByText('Swap position #3')).toBeInTheDocument()

    // Click swap with #1
    const swapWith1Button = screen.getByText('#1')
    fireEvent.click(swapWith1Button)

    // Position 1 should now have what was in 3:
    // "Verify the loan disbursement and documentation process."
    const inputs = screen.getAllByRole('textbox')
    expect(inputs[0]).toHaveValue(sampleActivities[2])
    // Position 3 should now have what was in 1:
    // "Observe the status of savings collections and refunds."
    expect(inputs[2]).toHaveValue(sampleActivities[0])
    // Position 2 remains untouched:
    expect(inputs[1]).toHaveValue(sampleActivities[1])

    // "Unsaved changes" badge and "Confirm Changes" button should appear
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    const confirmButtons = screen.getAllByRole('button', { name: /Confirm Changes/i })
    expect(confirmButtons[0]).toBeDefined()

    // Click Confirm Changes
    fireEvent.click(confirmButtons[0]!)

    // onSave is called with swapped array
    expect(onSave).toHaveBeenCalledTimes(1)
    const savedList = onSave.mock.calls[0]?.[0] as string[]
    expect(savedList).toBeDefined()
    expect(savedList[0]).toBe(sampleActivities[2])
    expect(savedList[1]).toBe(sampleActivities[1])
    expect(savedList[2]).toBe(sampleActivities[0])
  })

  it('allows moving/swapping adjacent items using up and down arrow buttons', () => {
    const { onSave } = renderActivitiesTab()

    // Down arrow on item 1 (index 0)
    const downButton = screen.getByRole('button', { name: 'Move activity 1 down' })
    fireEvent.click(downButton)

    const inputs = screen.getAllByRole('textbox')
    // 1 and 2 are swapped
    expect(inputs[0]).toHaveValue(sampleActivities[1])
    expect(inputs[1]).toHaveValue(sampleActivities[0])

    // Confirm
    const confirmButtons = screen.getAllByRole('button', { name: /Confirm Changes/i })
    fireEvent.click(confirmButtons[0]!)

    expect(onSave).toHaveBeenCalledWith([
      sampleActivities[1],
      sampleActivities[0],
      sampleActivities[2],
      sampleActivities[3],
      sampleActivities[4],
    ])
  })

  it('shows row-level confirm and revert buttons when editing text, and confirms on row confirm click', () => {
    const { onSave } = renderActivitiesTab()

    const inputs = screen.getAllByRole('textbox')
    const firstInput = inputs[0]!

    // Edit text of first activity
    fireEvent.change(firstInput, { target: { value: 'Updated first activity description.' } })

    // Row-level confirm and revert buttons should be visible
    const rowConfirmButton = screen.getByRole('button', {
      name: 'Confirm changes for activity 1',
    })
    const rowRevertButton = screen.getByRole('button', {
      name: 'Revert changes for activity 1',
    })
    expect(rowConfirmButton).toBeInTheDocument()
    expect(rowRevertButton).toBeInTheDocument()

    // Click revert
    fireEvent.click(rowRevertButton)
    expect(firstInput).toHaveValue(sampleActivities[0])
    expect(screen.queryByRole('button', { name: 'Confirm changes for activity 1' })).toBeNull()

    // Edit again and confirm via row button
    fireEvent.change(firstInput, { target: { value: 'Committed first activity edit.' } })
    const rowConfirmButton2 = screen.getByRole('button', {
      name: 'Confirm changes for activity 1',
    })
    fireEvent.click(rowConfirmButton2)

    expect(onSave).toHaveBeenCalledWith([
      'Committed first activity edit.',
      sampleActivities[1],
      sampleActivities[2],
      sampleActivities[3],
      sampleActivities[4],
    ])
  })

  it('pressing Enter in input confirms the row edit', () => {
    const { onSave } = renderActivitiesTab()

    const firstInput = screen.getAllByRole('textbox')[0]!
    fireEvent.change(firstInput, { target: { value: 'Quick enter confirmation.' } })
    fireEvent.keyDown(firstInput, { key: 'Enter', code: 'Enter' })

    expect(onSave).toHaveBeenCalledWith([
      'Quick enter confirmation.',
      sampleActivities[1],
      sampleActivities[2],
      sampleActivities[3],
      sampleActivities[4],
    ])
  })

  it('discard button resets changes back to initial state', () => {
    renderActivitiesTab()

    // Swap item 1 and item 2
    const downButton = screen.getByRole('button', { name: 'Move activity 1 down' })
    fireEvent.click(downButton)

    let inputs = screen.getAllByRole('textbox')
    expect(inputs[0]).toHaveValue(sampleActivities[1])

    // Click Discard
    const discardButtons = screen.getAllByRole('button', { name: 'Discard' })
    fireEvent.click(discardButtons[0]!)

    inputs = screen.getAllByRole('textbox')
    expect(inputs[0]).toHaveValue(sampleActivities[0])
    expect(screen.getByText('Changes Confirmed')).toBeInTheDocument()
  })

  it('allows adding new activities with input and + Add button', () => {
    const { onAdd } = renderActivitiesTab()

    const newActivityInput = screen.getByPlaceholderText('Add another monitoring activity')
    const addButton = screen.getByRole('button', { name: /Add/i })

    fireEvent.change(newActivityInput, { target: { value: 'Check branch vault compliance' } })
    fireEvent.click(addButton)

    expect(onAdd).toHaveBeenCalledWith('Check branch vault compliance')
    expect(newActivityInput).toHaveValue('')
  })
})

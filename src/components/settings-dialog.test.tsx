import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from './settings-dialog'
import { DEFAULT_BRANCHES, defaultSettings } from '@/lib/schema'

describe('SettingsDialog', () => {
  it('does not render export options or remembered values', () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={vi.fn()}
        settings={defaultSettings()}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Export options/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Merge identical adjacent temporary branch cells/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Show a cross mark beside temporary names/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Split displayed date ranges around holidays/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Remembered values/i)).not.toBeInTheDocument()
  })

  it('renders configured branches and allows adding a new branch', () => {
    const onChange = vi.fn()
    const settings = {
      ...defaultSettings(),
      recentBranchNames: ['Mangalpur, Dinajpur'],
    }

    render(
      <SettingsDialog
        open={true}
        onOpenChange={vi.fn()}
        settings={settings}
        onChange={onChange}
      />,
    )

    expect(screen.getByRole('heading', { name: /Branches/i })).toBeInTheDocument()
    expect(screen.getByText('Mangalpur, Dinajpur')).toBeInTheDocument()

    const branchInput = screen.getByLabelText(/Add a branch/i)
    fireEvent.change(branchInput, { target: { value: 'Kurigram Sadar, Kurigram' } })

    const addButtons = screen.getAllByRole('button', { name: /Add/i })
    const branchAddButton = addButtons[addButtons.length - 1]!
    fireEvent.click(branchAddButton)

    expect(onChange).toHaveBeenCalledWith({
      recentBranchNames: ['Mangalpur, Dinajpur', 'Kurigram Sadar, Kurigram'],
    })
  })

  it('allows removing a branch', () => {
    const onChange = vi.fn()
    const settings = {
      ...defaultSettings(),
      recentBranchNames: ['Mangalpur, Dinajpur', 'Hatrampur, Dinajpur'],
    }

    render(
      <SettingsDialog
        open={true}
        onOpenChange={vi.fn()}
        settings={settings}
        onChange={onChange}
      />,
    )

    const removeButton = screen.getByRole('button', { name: /Remove Mangalpur, Dinajpur/i })
    fireEvent.click(removeButton)

    expect(onChange).toHaveBeenCalledWith({
      recentBranchNames: ['Hatrampur, Dinajpur'],
    })
  })

  it('allows resetting branches to default list', () => {
    const onChange = vi.fn()
    const settings = {
      ...defaultSettings(),
      recentBranchNames: ['Custom Branch'],
    }

    render(
      <SettingsDialog
        open={true}
        onOpenChange={vi.fn()}
        settings={settings}
        onChange={onChange}
      />,
    )

    const resetButton = screen.getByRole('button', { name: /Reset to defaults/i })
    fireEvent.click(resetButton)

    expect(onChange).toHaveBeenCalledWith({
      recentBranchNames: [...DEFAULT_BRANCHES],
    })
  })
})

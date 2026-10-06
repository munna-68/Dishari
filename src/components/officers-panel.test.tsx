import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { OfficersPanel } from './officers-panel'

describe('OfficersPanel - Add temporary officer layout', () => {
  afterEach(() => {
    cleanup()
  })

  const dummyOfficers = [
    { id: 'off-1', name: 'Moyen Uddin', kind: 'permanent' as const, crossedOut: false },
  ]

  it('renders input on its own line and buttons in a secondary row', () => {
    const onAddTemporary = vi.fn()
    render(
      <TooltipProvider>
        <OfficersPanel
          officers={dummyOfficers}
          recentNames={['Jamir']}
          selectedOfficerId={null}
          onSelect={vi.fn()}
          onAddTemporary={onAddTemporary}
          onDismissRecent={vi.fn()}
          onToggleCrossOut={vi.fn()}
          onRename={vi.fn()}
          onRemove={vi.fn()}
          onReorder={vi.fn()}
          onSetRoster={vi.fn()}
        />
      </TooltipProvider>,
    )

    const input = screen.getByPlaceholderText('Name, then press Enter')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass('w-full')

    const addButton = screen.getByRole('button', { name: /add/i })
    const recentButton = screen.getByRole('button', { name: /recent/i })

    expect(addButton).toBeInTheDocument()
    expect(recentButton).toBeInTheDocument()

    // The buttons are in a flex container following the input
    expect(addButton.parentElement).toHaveClass('flex', 'items-center')
    expect(addButton.parentElement).toContainElement(recentButton)
    expect(addButton.parentElement).not.toContainElement(input)

    // Submitting through input Enter works
    fireEvent.change(input, { target: { value: 'Test Officer' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAddTemporary).toHaveBeenCalledWith('Test Officer')
  })

  it('submits through clicking the Add button', () => {
    const onAddTemporary = vi.fn()
    render(
      <TooltipProvider>
        <OfficersPanel
          officers={dummyOfficers}
          recentNames={[]}
          selectedOfficerId={null}
          onSelect={vi.fn()}
          onAddTemporary={onAddTemporary}
          onDismissRecent={vi.fn()}
          onToggleCrossOut={vi.fn()}
          onRename={vi.fn()}
          onRemove={vi.fn()}
          onReorder={vi.fn()}
          onSetRoster={vi.fn()}
        />
      </TooltipProvider>,
    )

    const input = screen.getByPlaceholderText('Name, then press Enter')
    const addButton = screen.getByRole('button', { name: /add/i })

    expect(addButton).toBeDisabled()

    fireEvent.change(input, { target: { value: 'New Officer' } })
    expect(addButton).not.toBeDisabled()

    fireEvent.click(addButton)
    expect(onAddTemporary).toHaveBeenCalledWith('New Officer')
  })

  it('triggers onCollapse when collapse button is clicked', () => {
    const onCollapse = vi.fn()
    render(
      <TooltipProvider>
        <OfficersPanel
          officers={dummyOfficers}
          recentNames={[]}
          selectedOfficerId={null}
          onSelect={vi.fn()}
          onAddTemporary={vi.fn()}
          onDismissRecent={vi.fn()}
          onToggleCrossOut={vi.fn()}
          onRename={vi.fn()}
          onRemove={vi.fn()}
          onReorder={vi.fn()}
          onSetRoster={vi.fn()}
          onCollapse={onCollapse}
        />
      </TooltipProvider>,
    )

    const collapseButton = screen.getByRole('button', { name: /collapse officers panel/i })
    expect(collapseButton).toBeInTheDocument()

    fireEvent.click(collapseButton)
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('allows adding a permanent officer and switching tabs', () => {
    const onAddPermanent = vi.fn()
    const onAddTemporary = vi.fn()

    render(
      <TooltipProvider>
        <OfficersPanel
          officers={dummyOfficers}
          rosterNames={['Moyen Uddin', 'Jamir Uddin']}
          recentNames={['Temp 1']}
          defaultMode="permanent"
          selectedOfficerId={null}
          onSelect={vi.fn()}
          onAddPermanent={onAddPermanent}
          onAddTemporary={onAddTemporary}
          onDismissRecent={vi.fn()}
          onToggleCrossOut={vi.fn()}
          onRename={vi.fn()}
          onRemove={vi.fn()}
          onReorder={vi.fn()}
          onSetRoster={vi.fn()}
        />
      </TooltipProvider>,
    )

    const input = screen.getByPlaceholderText('Name, then press Enter')
    const permanentTab = screen.getByRole('tab', { name: /permanent/i })
    const temporaryTab = screen.getByRole('tab', { name: /temporary/i })

    expect(permanentTab).toHaveAttribute('aria-selected', 'true')
    expect(temporaryTab).toHaveAttribute('aria-selected', 'false')

    // Add a permanent officer
    fireEvent.change(input, { target: { value: 'Jamir Uddin' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAddPermanent).toHaveBeenCalledWith('Jamir Uddin')

    // Switch to Temporary tab
    fireEvent.click(temporaryTab)
    expect(temporaryTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.change(input, { target: { value: 'New Temp Officer' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAddTemporary).toHaveBeenCalledWith('New Temp Officer')
  })

  it('allows restoring a crossed-out officer by typing their name or clicking Restore', () => {
    const onToggleCrossOut = vi.fn()
    const crossedOutOfficers = [
      { id: 'off-1', name: 'Moyen Uddin', kind: 'permanent' as const, crossedOut: true },
    ]

    render(
      <TooltipProvider>
        <OfficersPanel
          officers={crossedOutOfficers}
          rosterNames={['Moyen Uddin']}
          recentNames={[]}
          defaultMode="permanent"
          selectedOfficerId={null}
          onSelect={vi.fn()}
          onAddPermanent={vi.fn()}
          onAddTemporary={vi.fn()}
          onDismissRecent={vi.fn()}
          onToggleCrossOut={onToggleCrossOut}
          onRename={vi.fn()}
          onRemove={vi.fn()}
          onReorder={vi.fn()}
          onSetRoster={vi.fn()}
        />
      </TooltipProvider>,
    )

    const input = screen.getByPlaceholderText('Name, then press Enter')
    fireEvent.change(input, { target: { value: 'Moyen Uddin' } })

    // Restore banner button should appear
    const restoreBtn = screen.getByRole('button', { name: /^restore$/i })
    expect(restoreBtn).toBeInTheDocument()

    // Submitting by pressing Enter restores them
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onToggleCrossOut).toHaveBeenCalledWith('off-1')
  })

  it('allows removing a permanent officer with the trash button', () => {
    const onRemove = vi.fn()

    render(
      <TooltipProvider>
        <OfficersPanel
          officers={dummyOfficers}
          rosterNames={['Moyen Uddin']}
          recentNames={[]}
          selectedOfficerId={null}
          onSelect={vi.fn()}
          onAddPermanent={vi.fn()}
          onAddTemporary={vi.fn()}
          onDismissRecent={vi.fn()}
          onToggleCrossOut={vi.fn()}
          onRename={vi.fn()}
          onRemove={onRemove}
          onReorder={vi.fn()}
          onSetRoster={vi.fn()}
        />
      </TooltipProvider>,
    )

    const removeBtn = screen.getByRole('button', { name: /remove moyen uddin/i })
    expect(removeBtn).toBeInTheDocument()

    fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalledWith('off-1')
  })
})


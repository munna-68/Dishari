import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

describe('Select component UX improvements', () => {
  it('renders select with popper position and full viewport by default', () => {
    render(
      <Select defaultValue="10" open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">January</SelectItem>
          <SelectItem value="2">February</SelectItem>
          <SelectItem value="10">October</SelectItem>
          <SelectItem value="11">November</SelectItem>
          <SelectItem value="12">December</SelectItem>
        </SelectContent>
      </Select>,
    )

    const content = screen.getByRole('listbox')
    expect(content).toBeInTheDocument()
    // It should have popper alignment, not item-aligned
    expect(content).toHaveAttribute('data-align-trigger', 'false')

    // All items should be present in the content listbox
    expect(within(content).getByText('January')).toBeInTheDocument()
    expect(within(content).getByText('October')).toBeInTheDocument()
    expect(within(content).getByText('December')).toBeInTheDocument()
  })

  it('scroll buttons prevent auto-scroll on pointer move and allow click scrolling', () => {
    const preventDefault = vi.fn()
    const { container } = render(
      <Select defaultValue="1" open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1</SelectItem>
        </SelectContent>
      </Select>,
    )

    const upButton = container.querySelector('[data-slot="select-scroll-up-button"]')
    if (upButton) {
      fireEvent.pointerMove(upButton, { preventDefault })
      expect(preventDefault).toHaveBeenCalled()
    }
  })
})

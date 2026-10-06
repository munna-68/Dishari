import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmptyMonthState } from './empty-month-state'

describe('EmptyMonthState', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the starting options with Load default data, Start blank, and Start from last month in lower section', () => {
    const onLoadDefaultData = vi.fn()
    const onStartBlank = vi.fn()
    const onStartFromLastMonth = vi.fn()

    render(
      <EmptyMonthState
        monthKey="2027-10"
        onLoadDefaultData={onLoadDefaultData}
        onStartBlank={onStartBlank}
        onStartFromLastMonth={onStartFromLastMonth}
        previousMonthHasList={false}
      />,
    )

    // Month title
    expect(screen.getByText('October 2027 is not set up yet')).toBeInTheDocument()

    // Load default data button and description
    const loadDefaultButton = screen.getByRole('button', { name: /load default data/i })
    expect(loadDefaultButton).toBeInTheDocument()
    expect(
      screen.getByText(/pre-fills 9 permanent officers, 2 temporary monitoring managers/i),
    ).toBeInTheDocument()

    // Start blank button and description
    const startBlankButton = screen.getByRole('button', { name: /start blank/i })
    expect(startBlankButton).toBeInTheDocument()
    expect(
      screen.getByText(/starts fresh with the 9 permanent officers/i),
    ).toBeInTheDocument()

    // Start from last month button (in lower section) - disabled because previousMonthHasList is false
    const carryOverButton = screen.getByRole('button', { name: /start from last month/i })
    expect(carryOverButton).toBeInTheDocument()
    expect(carryOverButton).toBeDisabled()
    expect(
      screen.getByText(/last month \(september 2027\) has no saved schedule, so carry-over is unavailable/i),
    ).toBeInTheDocument()

    // Clicking buttons triggers callbacks
    fireEvent.click(loadDefaultButton)
    expect(onLoadDefaultData).toHaveBeenCalledTimes(1)

    fireEvent.click(startBlankButton)
    expect(onStartBlank).toHaveBeenCalledTimes(1)
  })

  it('enables Start from last month when previousMonthHasList is true', () => {
    const onStartFromLastMonth = vi.fn()

    render(
      <EmptyMonthState
        monthKey="2026-11"
        onLoadDefaultData={vi.fn()}
        onStartBlank={vi.fn()}
        onStartFromLastMonth={onStartFromLastMonth}
        previousMonthHasList={true}
      />,
    )

    const carryOverButton = screen.getByRole('button', { name: /start from last month \(october 2026\)/i })
    expect(carryOverButton).not.toBeDisabled()
    expect(
      screen.getByText(/carries over the activity list and temporary officers from october 2026/i),
    ).toBeInTheDocument()

    fireEvent.click(carryOverButton)
    expect(onStartFromLastMonth).toHaveBeenCalledTimes(1)
  })
})

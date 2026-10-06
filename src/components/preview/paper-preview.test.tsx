import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildDocumentModel } from '@/lib/document-model'
import { defaultSettings } from '@/lib/schema'
import { createSampleSchedule } from '@/lib/seed'
import { emptyHolidayContext } from '@/lib/working-days'
import { PaperPreview } from './paper-preview'

describe('PaperPreview', () => {
  const context = emptyHolidayContext([5, 6])
  const sampleSchedule = createSampleSchedule()
  const sampleModel = buildDocumentModel({
    settings: defaultSettings(),
    schedule: sampleSchedule,
    context,
  })

  it('renders title, heading, and table headers correctly', () => {
    render(<PaperPreview model={sampleModel} />)

    expect(screen.getByText('RDRS Bangladesh')).toBeInTheDocument()
    expect(screen.getByText('MEL Department')).toBeInTheDocument()
    expect(screen.getByText('Monitoring Schedule for October 2026')).toBeInTheDocument()
    expect(screen.getByText('Microfinance Program')).toBeInTheDocument()

    expect(screen.getByRole('columnheader', { name: 'Activity/Task' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Responsible Staff' })).toBeInTheDocument()
  })

  it('renders numbered activities inside list items without negative text-indent', () => {
    const { container } = render(<PaperPreview model={sampleModel} />)

    // The activity cell contains an ordered list
    const ol = container.querySelector('ol')
    expect(ol).toBeInTheDocument()

    const listItems = ol?.querySelectorAll('li')
    expect(listItems?.length).toBe(sampleSchedule.activities.length)

    listItems?.forEach((li, idx) => {
      // Must not use negative text-indent (which caused numbers to render outside the table)
      expect(li.style.textIndent).not.toBe('-1.4em')
      expect(li).toHaveClass('flex', 'items-start')

      // Number span
      const numSpan = li.querySelector('span.tabular-nums')
      expect(numSpan).toBeInTheDocument()
      expect(numSpan?.textContent).toBe(`${idx + 1}.`)

      // Content span
      const textSpan = li.querySelector('span.flex-1')
      expect(textSpan).toBeInTheDocument()
      expect(textSpan?.textContent).toBe(sampleSchedule.activities[idx])
    })
  })

  it('renders unnumbered lines gracefully if present', () => {
    const customModel = structuredClone(sampleModel)
    const firstBodyRow = customModel.rows[1]
    if (firstBodyRow?.cells[0]) {
      firstBodyRow.cells[0].text = '1. First task\nUnnumbered task line'
    }

    const { container } = render(<PaperPreview model={customModel} />)
    const listItems = container.querySelectorAll('ol li')
    expect(listItems.length).toBe(2)

    expect(listItems[0]?.querySelector('span.tabular-nums')?.textContent).toBe('1.')
    expect(listItems[0]?.querySelector('span.flex-1')?.textContent).toBe('First task')

    expect(listItems[1]?.querySelector('span.tabular-nums')).toBeNull()
    expect(listItems[1]?.querySelector('span.flex-1')?.textContent).toBe('Unnumbered task line')
  })
})

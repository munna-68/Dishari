import { describe, expect, it } from 'vitest'

import { buildDocumentModel } from './document-model'
import { docxFileName, renderScheduleDocx } from './export-docx'
import { pdfFileName, renderSchedulePdf } from './export-pdf'
import { createSampleSchedule } from './seed'
import { defaultSettings } from './schema'
import { emptyHolidayContext, setHoliday } from './working-days'

const model = buildDocumentModel({
  settings: defaultSettings(),
  schedule: createSampleSchedule(),
  context: emptyHolidayContext([5, 6]),
})

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function ascii(view: Uint8Array): string {
  let out = ''
  for (const byte of view) out += String.fromCharCode(byte)
  return out
}

describe('the PDF export', () => {
  it('produces a non-empty PDF blob', async () => {
    const blob = renderSchedulePdf(model)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(2_000)
  })

  it('starts with the PDF magic bytes', async () => {
    const view = await bytes(renderSchedulePdf(model))
    expect(ascii(view.slice(0, 5))).toBe('%PDF-')
    expect(ascii(view.slice(-8))).toContain('EOF')
  })

  it('is one page for a typical sheet of eleven officer rows', async () => {
    const view = await bytes(renderSchedulePdf(model))
    const text = ascii(view)
    // /Count in the page tree tells us how many pages were written.
    const counts = [...text.matchAll(/\/Count (\d+)/g)].map((match) => Number(match[1]))
    expect(Math.max(...counts)).toBe(1)
  })

  it('paginates and repeats the header row when the sheet is too tall', async () => {
    const schedule = createSampleSchedule()
    // Push the activity list well past one page worth of height.
    schedule.activities = Array.from({ length: 40 }, (_, index) => `Activity number ${index + 1} to observe.`)
    const tall = buildDocumentModel({ settings: defaultSettings(), schedule, context: emptyHolidayContext([5, 6]) })

    const view = await bytes(renderSchedulePdf(tall))
    const counts = [...ascii(view).matchAll(/\/Count (\d+)/g)].map((match) => Number(match[1]))
    expect(Math.max(...counts)).toBeGreaterThan(1)
  })

  it('uses the reference file name', () => {
    expect(pdfFileName(model)).toBe('Monitoring_Schedule_October_2026.pdf')
  })
})

describe('the Word export', () => {
  it('produces a real, non-empty docx blob', async () => {
    const blob = await renderScheduleDocx(model)
    expect(blob.size).toBeGreaterThan(2_000)
    const view = await bytes(blob)
    // A .docx is a ZIP container, which always starts with PK\\x03\\x04.
    expect(Array.from(view.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
  })

  it('uses the reference file name', () => {
    expect(docxFileName(model)).toBe('Monitoring_Schedule_October_2026.docx')
  })

  it('works when the two temporary officers share one merged cell', async () => {
    const merged = buildDocumentModel({
      settings: { ...defaultSettings(), mergeIdenticalTemporaryCells: true },
      schedule: createSampleSchedule(),
      context: emptyHolidayContext([5, 6]),
    })
    const blob = await renderScheduleDocx(merged)
    expect(blob.size).toBeGreaterThan(2_000)
  })

  it('works for a month with no officers at all', async () => {
    const empty = buildDocumentModel({
      settings: defaultSettings(),
      schedule: { ...createSampleSchedule(), officers: [], assignments: {} },
      context: emptyHolidayContext([5, 6]),
    })
    const blob = await renderScheduleDocx(empty)
    expect(blob.size).toBeGreaterThan(2_000)
    const pdf = renderSchedulePdf(empty)
    expect(pdf.size).toBeGreaterThan(1_000)
  })

  it('works when a holiday sits inside the visit windows', async () => {
    const withHoliday = buildDocumentModel({
      settings: defaultSettings(),
      schedule: createSampleSchedule(),
      context: setHoliday(emptyHolidayContext([5, 6]), '2026-10-08', {
        source: 'imported',
        nameEn: 'Holi',
      }),
    })
    expect(withHoliday.rows[1]?.cells[3]?.text).toBe('04-13 October')
    expect((await renderScheduleDocx(withHoliday)).size).toBeGreaterThan(2_000)
    expect(renderSchedulePdf(withHoliday).size).toBeGreaterThan(1_000)
  })
})
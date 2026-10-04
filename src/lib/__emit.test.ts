import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildDocumentModel } from './document-model'
import { renderScheduleDocx } from './export-docx'
import { renderSchedulePdf } from './export-pdf'
import { createSampleSchedule } from './seed'
import { defaultSettings } from './schema'
import { emptyHolidayContext } from './working-days'

it('emit', async () => {
  const model = buildDocumentModel({
    settings: defaultSettings(),
    schedule: createSampleSchedule(),
    context: emptyHolidayContext([5, 6]),
  })
  const pdf = renderSchedulePdf(model)
  writeFileSync('/tmp/msp-sample.pdf', Buffer.from(await pdf.arrayBuffer()))
  const docx = await renderScheduleDocx(model)
  writeFileSync('/tmp/msp-sample.docx', Buffer.from(await docx.arrayBuffer()))

  const merged = buildDocumentModel({
    settings: { ...defaultSettings(), mergeIdenticalTemporaryCells: true },
    schedule: createSampleSchedule(),
    context: emptyHolidayContext([5, 6]),
  })
  writeFileSync('/tmp/msp-merged.pdf', Buffer.from(await renderSchedulePdf(merged).arrayBuffer()))
  writeFileSync('/tmp/msp-merged.docx', Buffer.from(await (await renderScheduleDocx(merged)).arrayBuffer()))
})

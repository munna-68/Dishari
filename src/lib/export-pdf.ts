import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CellDef, RowInput } from 'jspdf-autotable'
import { columnWidthsPercent, layoutRows, type DocCell, type DocumentModel } from './document-model'

/** A4 landscape, matching the paper sheet the office prints on. */
const PAGE_WIDTH_MM = 297
const PAGE_HEIGHT_MM = 210
const MARGIN_MM = 12
const FOOTER_MM = 8

const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2

const RULE: [number, number, number] = [70, 70, 70]
const HEADER_FILL: [number, number, number] = [224, 224, 224]
const INK: [number, number, number] = [20, 20, 20]

const FONT_SIZE_BODY = 8.5
const LINE_HEIGHT_MM = 3.6
/** Width of the "12." gutter that continuation lines hang under. */
const NUMBER_GUTTER_MM = 5.5

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoke a tick later so every browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
}

/**
 * Wraps the numbered activity list itself so each continuation line is indented
 * under the text rather than under the number. Doing it up front means
 * AutoTable still measures the row height correctly.
 */
function wrapActivityCell(doc: jsPDF, cell: DocCell, widthMm: number): string {
  const textWidth = Math.max(10, widthMm - 2 - NUMBER_GUTTER_MM)
  doc.setFontSize(FONT_SIZE_BODY)
  const out: string[] = []

  for (const rawLine of cell.text.split('\n')) {
    const match = /^(\d+\.)\s*(.*)$/.exec(rawLine.trim())
    if (!match) {
      if (rawLine.trim() !== '') out.push(rawLine.trim())
      continue
    }
    const number = match[1] ?? ''
    const body = match[2] ?? ''
    const wrapped = doc.splitTextToSize(body, textWidth) as string[]
    if (wrapped.length === 0) {
      out.push(number)
      continue
    }
    const first = wrapped[0] ?? ''
    out.push(`${number}  ${first}`)
    const indent = '\u00A0'.repeat(5)
    for (const continuation of wrapped.slice(1)) out.push(`${indent}${continuation}`)
  }

  return out.join('\n')
}

function toCell(cell: DocCell, activityWidthMm: number, doc: jsPDF): CellDef {
  const content = cell.hangingIndent ? wrapActivityCell(doc, cell, activityWidthMm) : cell.text
  const styles: Record<string, unknown> = {
    halign: cell.align,
    valign: 'middle',
    bold: cell.bold,
  }
  if (cell.shaded) styles.fillColor = HEADER_FILL
  return { content, rowSpan: cell.rowSpan, colSpan: cell.colSpan, styles: styles as CellDef['styles'] }
}

/**
 * Builds the landscape A4 PDF that mirrors the reference sheet: centred
 * organisation block, left-aligned programme line, one bordered table with a
 * grey bold header, a merged Activity/Task cell and a page-number footer.
 */
export function renderSchedulePdf(model: DocumentModel): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const widths = columnWidthsPercent(model.columns)
  const activityWidthMm = (CONTENT_WIDTH_MM * (widths[0] ?? 100)) / 100

  doc.setTextColor(...INK)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(model.title, PAGE_WIDTH_MM / 2, 20, { align: 'center' })

  doc.setFontSize(13)
  doc.text(model.subtitle, PAGE_WIDTH_MM / 2, 27.5, { align: 'center' })

  doc.setFontSize(15)
  doc.text(model.heading, PAGE_WIDTH_MM / 2, 36, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(model.programLine, MARGIN_MM, 44)

  const columnStyles: Record<number, Record<string, unknown>> = {}
  model.columns.forEach((_, index) => {
    columnStyles[index] = {
      cellWidth: (CONTENT_WIDTH_MM * (widths[index] ?? 0)) / 100,
      halign: 'left',
    }
  })

  const head: RowInput[] = [
    (model.rows[0]?.cells ?? []).map((cell) => toCell(cell, activityWidthMm, doc)),
  ]

  // Positions covered by a vertical merge are simply omitted, which is how
  // AutoTable expects a row span to look.
  const body: RowInput[] = layoutRows(model.rows.slice(1)).map((row) =>
    row
      .filter((entry) => entry.merge !== 'continue')
      .map((entry) => toCell(entry.cell, activityWidthMm, doc)),
  )

  autoTable(doc, {
    startY: 47,
    margin: {
      left: MARGIN_MM,
      right: MARGIN_MM,
      top: MARGIN_MM,
      bottom: MARGIN_MM + FOOTER_MM,
    },
    tableWidth: CONTENT_WIDTH_MM,
    theme: 'grid',
    showHead: 'everyPage',
    head,
    body,
    // Repeat the six headings when the table spills onto a second page.
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: RULE,
    },
    bodyStyles: {
      textColor: INK,
      fontSize: FONT_SIZE_BODY,
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: RULE,
      overflow: 'linebreak',
      minCellHeight: LINE_HEIGHT_MM,
    },
    columnStyles,
    rowPageBreak: 'avoid',
    didParseCell(data) {
      if (data.section === 'body') data.cell.styles.cellPadding = 1.1
    },
    didDrawPage(data) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...INK)
      doc.text(`Page | ${data.pageNumber}`, PAGE_WIDTH_MM - MARGIN_MM, PAGE_HEIGHT_MM - 6, {
        align: 'right',
      })
    },
  })

  return doc.output('blob')
}

export function pdfFileName(model: DocumentModel): string {
  return `${model.fileBaseName}.pdf`
}
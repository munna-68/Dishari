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
const TABLE_TOP_MM = 47
/** Vertical space the table has: from the table top to just above the footer. */
const TABLE_HEIGHT_MM = PAGE_HEIGHT_MM - TABLE_TOP_MM - MARGIN_MM - FOOTER_MM
/** Rounding slack so the last row never tips onto a second page. */
const TABLE_SLACK_MM = 5
const MIN_ROW_HEIGHT_MM = 6
const MAX_ROW_HEIGHT_MM = 16
const HEADER_ROW_MAX_MM = 10
const BODY_CELL_PADDING_MM = 1.1

const RULE: [number, number, number] = [70, 70, 70]
const HEADER_FILL: [number, number, number] = [224, 224, 224]
const INK: [number, number, number] = [20, 20, 20]

const FONT_SIZE_BODY = 8.5
/** Guards against rounding pushing a line over the cell edge. */
const SAFETY_MM = 0.6

/**
 * Wraps the numbered activity list itself so each continuation line is indented
 * under the text rather than under the number. Doing it up front means
 * AutoTable still measures the row height correctly.
 *
 * The indent is measured rather than guessed: every produced line is guaranteed
 * to fit the cell width, so AutoTable never re-wraps and never inflates the
 * merged cell past the page.
 */
function wrapActivityCell(doc: jsPDF, cell: DocCell, cellWidthMm: number): string {
  const available = cellWidthMm - 2 * BODY_CELL_PADDING_MM
  doc.setFontSize(FONT_SIZE_BODY)

  const nbspWidth = doc.getTextWidth('\u00A0')
  const widestNumber = doc.getTextWidth('10.  ')
  const indentCount = Math.max(1, Math.ceil(widestNumber / nbspWidth))
  const indentWidth = indentCount * nbspWidth
  const indent = '\u00A0'.repeat(indentCount)
  const textWidth = Math.max(10, available - indentWidth - SAFETY_MM)

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
    out.push(`${number}  ${wrapped[0] ?? ''}`)
    for (const continuation of wrapped.slice(1)) out.push(`${indent}${continuation}`)
  }

  return out.join('\n')
}

function toCell(cell: DocCell, activityWidthMm: number, doc: jsPDF): CellDef {
  const content = cell.hangingIndent ? wrapActivityCell(doc, cell, activityWidthMm) : cell.text
  const styles: Record<string, unknown> = {
    halign: cell.align,
    // The tall merged activity list reads better from the top of its cell.
    valign: cell.hangingIndent ? 'top' : 'middle',
    bold: cell.bold,
  }
  if (cell.shaded) styles.fillColor = HEADER_FILL
  return { content, rowSpan: cell.rowSpan, colSpan: cell.colSpan, styles: styles as CellDef['styles'] }
}

/**
 * Draws the whole sheet with one explicit row height. AutoTable paginates
 * rowSpan tables unpredictably, so the caller retries with shorter rows rather
 * than trusting the break behaviour.
 */
function drawSheet(
  model: DocumentModel,
  widths: number[],
  activityWidthMm: number,
  rowHeight: number,
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

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
    startY: TABLE_TOP_MM,
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
      minCellHeight: Math.min(rowHeight, HEADER_ROW_MAX_MM),
    },
    bodyStyles: {
      textColor: INK,
      fontSize: FONT_SIZE_BODY,
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: RULE,
      overflow: 'linebreak',
      minCellHeight: rowHeight,
    },
    columnStyles,
    // `rowPageBreak: 'avoid'` must stay off: AutoTable then forces a new page
    // for any row containing a row span, which throws the whole table onto page 2.
    didParseCell(data) {
      if (data.section === 'body') data.cell.styles.cellPadding = BODY_CELL_PADDING_MM
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

  return doc
}

/** Tallest first, so a normal sheet keeps the generous row height of the paper original. */
function candidateRowHeights(officerRowCount: number): number[] {
  const rowTotal = Math.max(1, officerRowCount + 1)
  const tallest = Math.min(
    MAX_ROW_HEIGHT_MM,
    (TABLE_HEIGHT_MM - TABLE_SLACK_MM) / rowTotal,
  )
  const heights: number[] = []
  for (let height = tallest; height >= MIN_ROW_HEIGHT_MM; height -= 0.4) {
    heights.push(Math.round(height * 10) / 10)
  }
  return heights
}

/**
 * Builds the landscape A4 PDF that mirrors the reference sheet: centred
 * organisation block, left-aligned programme line, one bordered table with a
 * grey bold header, a merged Activity/Task cell and a page-number footer.
 *
 * The row height is chosen by trying progressively shorter rows until the sheet
 * fits on one page, which is what keeps a normal month on a single sheet.
 */
export function renderSchedulePdf(model: DocumentModel): Blob {
  const widths = columnWidthsPercent(model.columns)
  const activityWidthMm = (CONTENT_WIDTH_MM * (widths[0] ?? 100)) / 100
  const heights = candidateRowHeights(model.rows.length - 1)

  let last: jsPDF | null = null
  for (const rowHeight of heights) {
    const doc = drawSheet(model, widths, activityWidthMm, rowHeight)
    last = doc
    if (doc.getNumberOfPages() === 1) return doc.output('blob')
  }

  // Nothing fit, so let AutoTable paginate with the shortest rows we allow.
  return (last ?? drawSheet(model, widths, activityWidthMm, MIN_ROW_HEIGHT_MM)).output('blob')
}

export function pdfFileName(model: DocumentModel): string {
  return `${model.fileBaseName}.pdf`
}
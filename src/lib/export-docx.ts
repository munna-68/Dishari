import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from 'docx'
import { columnWidthsPercent, layoutRows, type DocCell, type DocumentModel } from './document-model'

/** A4 landscape with the same margins as the PDF so both files look alike. */
const PAGE_WIDTH_MM = 297
const PAGE_HEIGHT_MM = 210
const MARGIN_MM = 12

const HEADER_FILL = 'E0E0E0'

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const CELL_BORDERS = { top: TABLE_BORDER, bottom: TABLE_BORDER, left: TABLE_BORDER, right: TABLE_BORDER }

function centered(text: string, sizeHalfPoints: number, bold: boolean): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, size: sizeHalfPoints, bold })],
  })
}

/**
 * Numbered activities become one Word paragraph each with a hanging indent, so
 * the list stays editable instead of collapsing into a single frozen blob.
 */
function activityParagraphs(cell: DocCell): Paragraph[] {
  const lines = cell.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  if (lines.length === 0) return [new Paragraph({ children: [] })]

  return lines.map((line) => {
    const match = /^(\d+\.)\s*(.*)$/.exec(line)
    const number = match?.[1] ?? ''
    const body = match?.[2] ?? line
    return new Paragraph({
      spacing: { before: 0, after: 40 },
      indent: { left: convertMillimetersToTwip(6), hanging: convertMillimetersToTwip(6) },
      children: [
        new TextRun({ text: number === '' ? '' : `${number} `, size: 16 }),
        new TextRun({ text: body, size: 16 }),
      ],
    })
  })
}

function cellContent(cell: DocCell): Paragraph[] {
  if (cell.hangingIndent) return activityParagraphs(cell)
  if (cell.text.trim() === '') return [new Paragraph({ children: [] })]
  return cell.text.split('\n').map(
    (line) =>
      new Paragraph({
        alignment: cell.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: line, size: 17, bold: cell.bold })],
      }),
  )
}

function buildCell(cell: DocCell, widthTwips: number, merge: 'restart' | 'continue' | null): TableCell {
  return new TableCell({
    children: cellContent(cell),
    width: { size: widthTwips, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    borders: CELL_BORDERS,
    ...(cell.shaded ? { shading: { type: ShadingType.CLEAR, fill: HEADER_FILL, color: 'auto' } } : {}),
    ...(merge ? { verticalMerge: merge } : {}),
  })
}

/**
 * Fully editable Word table with a vertically merged Activity/Task cell,
 * landscape orientation, a shaded header row and a real page-number field.
 */
export async function renderScheduleDocx(model: DocumentModel): Promise<Blob> {
  const columnCount = model.columns.length
  const usableTwips = convertMillimetersToTwip(PAGE_WIDTH_MM - MARGIN_MM * 2)
  const widthsPercent = columnWidthsPercent(model.columns)
  const columnWidths = widthsPercent.map((percent) => Math.round((usableTwips * percent) / 100))
  const widthOf = (index: number): number => columnWidths[index] ?? Math.round(usableTwips / columnCount)

  const headerRow = new TableRow({
    tableHeader: true,
    children: (model.rows[0]?.cells ?? []).map((cell, index) => buildCell(cell, widthOf(index), null)),
  })

  const bodyRows = layoutRows(model.rows.slice(1)).map(
    (row) =>
      new TableRow({
        children: row.map((entry, index) =>
          buildCell(
            entry.cell,
            widthOf(index),
            entry.merge === null ? null : entry.merge === 'start' ? 'restart' : 'continue',
          ),
        ),
      }),
  )

  const table = new Table({
    width: { size: usableTwips, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths,
    rows: [headerRow, ...bodyRows],
  })

  const document = new Document({
    creator: 'Monitoring Schedule Planner',
    title: model.heading,
    description: `${model.title} - ${model.subtitle}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(PAGE_WIDTH_MM),
              height: convertMillimetersToTwip(PAGE_HEIGHT_MM),
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: convertMillimetersToTwip(MARGIN_MM),
              right: convertMillimetersToTwip(MARGIN_MM),
              bottom: convertMillimetersToTwip(MARGIN_MM),
              left: convertMillimetersToTwip(MARGIN_MM),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Page | ', size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
                ],
              }),
            ],
          }),
        },
        children: [
          centered(model.title, 44, true),
          centered(model.subtitle, 26, true),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 200 },
            children: [new TextRun({ text: model.heading, bold: true, size: 30 })],
          }),
          new Paragraph({
            spacing: { before: 0, after: 200 },
            children: [new TextRun({ text: model.programLine, size: 20 })],
          }),
          table,
        ],
      },
    ],
  })

  return Packer.toBlob(document)
}

export function docxFileName(model: DocumentModel): string {
  return `${model.fileBaseName}.docx`
}
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
  type ITableCellBorders,
} from 'docx'
import { columnWidthsPercent, layoutRows, type DocCell, type DocumentModel } from './document-model'

/** A4 landscape with matching geometry to the PDF export. */
const PAGE_WIDTH_MM = 297
const PAGE_HEIGHT_MM = 210
const MARGIN_MM = 12
const FOOTER_MM = 8

const TABLE_TOP_MM = 47
const TABLE_HEIGHT_MM = PAGE_HEIGHT_MM - TABLE_TOP_MM - MARGIN_MM - FOOTER_MM
const TABLE_SLACK_MM = 5
const MIN_ROW_HEIGHT_MM = 6
const MAX_ROW_HEIGHT_MM = 16
const HEADER_ROW_MAX_MM = 10
const BODY_CELL_PADDING_MM = 1.1

const RULE_COLOR = '464646'
const HEADER_FILL = 'E0E0E0'
const INK_COLOR = '141414'
const FONT_FAMILY = 'Arial'

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: RULE_COLOR }
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' }

const CELL_BORDERS: ITableCellBorders = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
}

const MERGE_START_BORDERS: ITableCellBorders = {
  top: TABLE_BORDER,
  bottom: NO_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
}

const MERGE_MIDDLE_BORDERS: ITableCellBorders = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
}

const MERGE_END_BORDERS: ITableCellBorders = {
  top: NO_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
}

function calculateRowHeights(bodyRowCount: number): { headerTwips: number; bodyTwips: number } {
  const rowTotal = Math.max(1, bodyRowCount + 1)
  const availableMm = TABLE_HEIGHT_MM - TABLE_SLACK_MM
  const bodyMm = Math.min(MAX_ROW_HEIGHT_MM, Math.max(MIN_ROW_HEIGHT_MM, availableMm / rowTotal))
  const headerMm = Math.min(bodyMm, HEADER_ROW_MAX_MM)
  return {
    headerTwips: Math.round(convertMillimetersToTwip(headerMm)),
    bodyTwips: Math.round(convertMillimetersToTwip(bodyMm)),
  }
}

/**
 * Numbered activities become Word paragraphs with a precise hanging indent and tab stop,
 * ensuring continuation lines and first-line body text align seamlessly without artifacts.
 */
function activityParagraphs(cell: DocCell): Paragraph[] {
  const lines = cell.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  if (lines.length === 0) {
    return [new Paragraph({ spacing: { before: 0, after: 0, line: 240 }, children: [] })]
  }

  const indentTwips = Math.round(convertMillimetersToTwip(5.5))

  return lines.map((line, index) => {
    const match = /^(\d+\.)\s*(.*)$/.exec(line)
    const isLast = index === lines.length - 1
    const spacingAfter = isLast ? 0 : 25

    if (!match) {
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: spacingAfter, line: 240 },
        children: [
          new TextRun({
            text: line,
            font: FONT_FAMILY,
            size: 17,
            color: INK_COLOR,
          }),
        ],
      })
    }

    const number = match[1] ?? ''
    const body = match[2] ?? ''

    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: spacingAfter, line: 240 },
      indent: { left: indentTwips, hanging: indentTwips },
      tabStops: [{ type: TabStopType.LEFT, position: indentTwips }],
      children: [
        new TextRun({
          text: `${number}\t`,
          font: FONT_FAMILY,
          size: 17,
          color: INK_COLOR,
        }),
        new TextRun({
          text: body,
          font: FONT_FAMILY,
          size: 17,
          color: INK_COLOR,
        }),
      ],
    })
  })
}

function cellContent(cell: DocCell, isHeader = false): Paragraph[] {
  if (cell.hangingIndent) {
    return activityParagraphs(cell)
  }

  const alignment = isHeader || cell.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT
  const size = isHeader ? 19 : 17
  const bold = isHeader ? true : cell.bold

  if (cell.text.trim() === '') {
    return [
      new Paragraph({
        alignment,
        spacing: { before: 0, after: 0, line: 240 },
        children: [],
      }),
    ]
  }

  const lines = cell.text.split('\n')
  return lines.map(
    (line) =>
      new Paragraph({
        alignment,
        spacing: { before: 0, after: 0, line: 240 },
        children: [
          new TextRun({
            text: line,
            font: FONT_FAMILY,
            size,
            bold,
            color: INK_COLOR,
          }),
        ],
      }),
  )
}

interface BuildCellOptions {
  cell: DocCell
  widthTwips: number
  verticalMerge?: 'restart' | 'continue'
  columnSpan?: number
  borders?: ITableCellBorders
  isHeader?: boolean
}

function buildCell(options: BuildCellOptions): TableCell {
  const { cell, widthTwips, verticalMerge, columnSpan, borders, isHeader = false } = options
  return new TableCell({
    children: cellContent(cell, isHeader),
    width: { size: widthTwips, type: WidthType.DXA },
    verticalAlign: cell.hangingIndent ? VerticalAlign.TOP : VerticalAlign.CENTER,
    borders: borders ?? CELL_BORDERS,
    ...(cell.shaded || isHeader ? { shading: { type: ShadingType.CLEAR, fill: HEADER_FILL, color: 'auto' } } : {}),
    ...(verticalMerge ? { verticalMerge } : {}),
    ...(columnSpan && columnSpan > 1 ? { columnSpan } : {}),
  })
}

/**
 * Builds the landscape A4 Word document mirroring the reference sheet and PDF layout:
 * - Matching geometry, margins, ink colors, and font proportions.
 * - Perfectly aligned hanging indents for numbered activity lists.
 * - Top-aligned merged Activity/Task column without interior horizontal line artifacts.
 * - Centered bold header row with repeated headers across any multi-page overflow.
 * - Single-page row budget scaling and un-splittable row formatting.
 */
export async function renderScheduleDocx(model: DocumentModel): Promise<Blob> {
  const columnCount = model.columns.length
  const usableTwips = convertMillimetersToTwip(PAGE_WIDTH_MM - MARGIN_MM * 2)
  const widthsPercent = columnWidthsPercent(model.columns)
  const columnWidths = widthsPercent.map((percent) => Math.round((usableTwips * percent) / 100))

  const allocated = columnWidths.reduce((sum, w) => sum + w, 0)
  const lastIndex = columnWidths.length - 1
  if (lastIndex >= 0 && allocated !== usableTwips && columnWidths[lastIndex] !== undefined) {
    columnWidths[lastIndex] += usableTwips - allocated
  }

  const widthOf = (index: number): number => columnWidths[index] ?? Math.round(usableTwips / columnCount)

  const rawBodyRows = model.rows.slice(1)
  const isSingleEmptyRow =
    rawBodyRows.length === 1 && (rawBodyRows[0]?.cells[0]?.colSpan ?? 1) >= columnCount

  const rowHeights = calculateRowHeights(rawBodyRows.length)

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    height: { value: rowHeights.headerTwips, rule: HeightRule.ATLEAST },
    children: (model.rows[0]?.cells ?? []).map((cell, index) =>
      buildCell({
        cell,
        widthTwips: widthOf(index),
        borders: CELL_BORDERS,
        isHeader: true,
      }),
    ),
  })

  let bodyRows: TableRow[]

  if (isSingleEmptyRow) {
    const emptyCell = rawBodyRows[0]!.cells[0]!
    bodyRows = [
      new TableRow({
        cantSplit: true,
        height: { value: rowHeights.bodyTwips, rule: HeightRule.ATLEAST },
        children: [
          buildCell({
            cell: emptyCell,
            widthTwips: usableTwips,
            columnSpan: columnCount,
            borders: CELL_BORDERS,
          }),
        ],
      }),
    ]
  } else {
    const grid = layoutRows(rawBodyRows)
    bodyRows = grid.map((row, rowIndex) =>
      new TableRow({
        cantSplit: true,
        height: { value: rowHeights.bodyTwips, rule: HeightRule.ATLEAST },
        children: row.map((entry, colIndex) => {
          let borders = CELL_BORDERS
          let verticalMerge: 'restart' | 'continue' | undefined

          if (entry.merge === 'start') {
            verticalMerge = 'restart'
            borders = MERGE_START_BORDERS
          } else if (entry.merge === 'continue') {
            verticalMerge = 'continue'
            const isLastContinue =
              rowIndex + 1 >= grid.length || grid[rowIndex + 1]?.[colIndex]?.merge !== 'continue'
            borders = isLastContinue ? MERGE_END_BORDERS : MERGE_MIDDLE_BORDERS
          }

          const colSpan = entry.cell.colSpan > 1 ? entry.cell.colSpan : undefined
          const widthTwips = colSpan && colSpan >= columnCount ? usableTwips : widthOf(colIndex)

          return buildCell({
            cell: entry.cell,
            widthTwips,
            verticalMerge,
            columnSpan: colSpan,
            borders,
          })
        }),
      }),
    )
  }

  const table = new Table({
    width: { size: usableTwips, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths,
    margins: {
      top: Math.round(convertMillimetersToTwip(BODY_CELL_PADDING_MM)),
      bottom: Math.round(convertMillimetersToTwip(BODY_CELL_PADDING_MM)),
      left: Math.round(convertMillimetersToTwip(BODY_CELL_PADDING_MM)),
      right: Math.round(convertMillimetersToTwip(BODY_CELL_PADDING_MM)),
    },
    borders: {
      top: TABLE_BORDER,
      bottom: TABLE_BORDER,
      left: TABLE_BORDER,
      right: TABLE_BORDER,
      insideHorizontal: TABLE_BORDER,
      insideVertical: TABLE_BORDER,
    },
    rows: [headerRow, ...bodyRows],
  })

  const document = new Document({
    creator: 'Monitoring Schedule Planner',
    title: model.heading,
    description: `${model.title} - ${model.subtitle}`,
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: 17,
            color: INK_COLOR,
          },
          paragraph: {
            spacing: { before: 0, after: 0, line: 240 },
          },
        },
      },
    },
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
              footer: convertMillimetersToTwip(6),
              header: convertMillimetersToTwip(6),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({ text: 'Page | ', font: FONT_FAMILY, size: 17, color: INK_COLOR }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT_FAMILY, size: 17, color: INK_COLOR }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60, line: 240 },
            children: [
              new TextRun({
                text: model.title,
                font: FONT_FAMILY,
                size: 44,
                bold: true,
                color: INK_COLOR,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 80, line: 240 },
            children: [
              new TextRun({
                text: model.subtitle,
                font: FONT_FAMILY,
                size: 26,
                bold: true,
                color: INK_COLOR,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 120, line: 240 },
            children: [
              new TextRun({
                text: model.heading,
                font: FONT_FAMILY,
                size: 30,
                bold: true,
                color: INK_COLOR,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 0, after: 100, line: 240 },
            children: [
              new TextRun({
                text: model.programLine,
                font: FONT_FAMILY,
                size: 20,
                color: INK_COLOR,
              }),
            ],
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
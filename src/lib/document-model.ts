import type { DateRange } from './date-format'
import { formatRangeText } from './date-format'
import { MONTH_NAMES } from './date'
import type { AppSettings, Assignment, MonthSchedule, Officer, WindowKey } from './schema'
import type { HolidayContext } from './working-days'

export type CellAlign = 'left' | 'center' | 'right'

export interface DocCell {
  text: string
  /** Number of table rows this cell covers vertically. 1 means no merge. */
  rowSpan: number
  /** Number of table columns this cell covers. 1 means no merge. */
  colSpan: number
  align: CellAlign
  bold: boolean
  /** Grey header shading. */
  shaded: boolean
  /** Indent continuation lines under the activity number. */
  hangingIndent: boolean
}

/**
 * One printable row. `cells` always holds exactly one entry per column, in the
 * same order as `columns`, so no consumer has to guess at index shifts. The
 * Activity cell is only meaningful on the first row, where its `rowSpan` covers
 * every officer row.
 */
export interface DocRow {
  cells: DocCell[]
}

export type MergeKind = 'start' | 'continue' | null

export interface GridEntry {
  cell: DocCell
  merge: MergeKind
}

/**
 * Turns rows into a full rectangular grid. Every position covered by a vertical
 * merge is marked `continue`; the PDF drops those positions while Word emits an
 * empty continuing cell for them.
 */
export function layoutRows(rows: DocRow[]): GridEntry[][] {
  const covered: number[] = []
  return rows.map((row) =>
    row.cells.map((cell, columnIndex) => {
      if ((covered[columnIndex] ?? 0) > 0) {
        covered[columnIndex] = (covered[columnIndex] ?? 0) - 1
        return { cell: docCell(), merge: 'continue' as const }
      }
      if (cell.rowSpan > 1) {
        covered[columnIndex] = cell.rowSpan - 1
        return { cell, merge: 'start' as const }
      }
      return { cell, merge: null }
    }),
  )
}

export interface DocColumn {
  key: string
  header: string
  /** Relative weight; the renderer normalises to the printable width. */
  weight: number
}

export interface DocumentModel {
  fileBaseName: string
  /** Centred block at the top of the sheet. */
  title: string
  subtitle: string
  heading: string
  /** Left-aligned, smaller, under the heading. */
  programLine: string
  columns: DocColumn[]
  rows: DocRow[]
  /** Shown instead of the table body when a month has nothing to print. */
  emptyMessage: string | null
  exportWarnings: string[]
}

const COLUMN_WEIGHTS = {
  activity: 92,
  staff: 50,
  branch: 72,
  visit: 40,
} as const

export const SCHEDULE_COLUMNS: DocColumn[] = [
  { key: 'activity', header: 'Activity/Task', weight: COLUMN_WEIGHTS.activity },
  { key: 'staff', header: 'Responsible Staff', weight: COLUMN_WEIGHTS.staff },
  { key: 'branch1', header: 'Branch', weight: COLUMN_WEIGHTS.branch },
  { key: 'visit1', header: 'Visit Schedule', weight: COLUMN_WEIGHTS.visit },
  { key: 'branch2', header: 'Branch', weight: COLUMN_WEIGHTS.branch },
  { key: 'visit2', header: 'Visit Schedule', weight: COLUMN_WEIGHTS.visit },
]

export function activityText(activities: string[]): string {
  return activities
    .map((activity, index) => `${index + 1}. ${activity.trim()}`)
    .filter((line) => line.replace(/^\d+\.\s*/, '') !== '')
    .join('\n')
}

export function printableStaffName(officer: Officer, crossMark: boolean): string {
  if (crossMark && officer.kind === 'temporary') return `× ${officer.name}`
  return officer.name
}

/** Permanent officers always come first, then temporaries, each in stored order. */
export function officersInExportOrder(officers: Officer[]): Officer[] {
  return [
    ...officers.filter((officer) => officer.kind === 'permanent'),
    ...officers.filter((officer) => officer.kind === 'temporary'),
  ]
}

export function printableOfficers(schedule: MonthSchedule): Officer[] {
  return officersInExportOrder(schedule.officers).filter((officer) => !officer.crossedOut)
}

export function docCell(overrides: Partial<DocCell> = {}): DocCell {
  return {
    text: '',
    rowSpan: 1,
    colSpan: 1,
    align: 'left',
    bold: false,
    shaded: false,
    hangingIndent: false,
    ...overrides,
  }
}

export interface BuildDocumentInput {
  settings: AppSettings
  schedule: MonthSchedule
  context: HolidayContext
}

/**
 * Turns planner state into the exact table that the preview, the PDF and the
 * Word file all render, so the three can never drift apart.
 */
export function buildDocumentModel(input: BuildDocumentInput): DocumentModel {
  const { settings, schedule, context } = input
  const monthNumber = schedule.month
  const monthName = MONTH_NAMES[monthNumber - 1] ?? ''
  const heading = `Monitoring Schedule for ${monthName} ${schedule.year}`
  const fileBaseName = `Monitoring_Schedule_${monthName}_${schedule.year}`

  const split = settings.splitRangesAroundHolidays
  const officers = printableOfficers(schedule)
  const mergeTemporary = settings.mergeIdenticalTemporaryCells

  const headerRow: DocRow = {
    cells: SCHEDULE_COLUMNS.map((column) => docCell({ text: column.header, bold: true, shaded: true })),
  }

  const emptyMessage =
    officers.length === 0 ? 'No officers are listed for this month yet.' : null

  const rows: DocRow[] = [headerRow]
  const exportWarnings: string[] = []

  const visitText = (assignment: Assignment | undefined, windowKey: WindowKey): string => {
    if (!assignment) return ''
    const ranges: DateRange[] =
      assignment.customRanges.length > 0 ? assignment.customRanges : [schedule.windows[windowKey]]
    return formatRangeText(ranges, { splitAroundHolidays: split, context })
  }

  const branchText = (assignment: Assignment | undefined): string => assignment?.branch.trim() ?? ''

  // Merge runs of identical adjacent temporary branch cells when the setting is on.
  const mergeRuns = new Map<WindowKey, Map<number, number>>()

  if (mergeTemporary) {
    for (const windowKey of ['one', 'two'] as const) {
      const runs = new Map<number, number>()
      let start = 0
      while (start < officers.length) {
        const officer = officers[start] as Officer
        let end = start + 1
        if (officer.kind === 'temporary') {
          const text = branchText(schedule.assignments[officer.id]?.[windowKey])
          while (end < officers.length) {
            const next = officers[end] as Officer
            if (next.kind !== 'temporary') break
            if (branchText(schedule.assignments[next.id]?.[windowKey]) !== text) break
            end += 1
          }
        }
        if (end - start > 1) runs.set(start, end - start)
        start = end
      }
      mergeRuns.set(windowKey, runs)
    }
  }

  officers.forEach((officer, index) => {
    const assignment = schedule.assignments[officer.id]
    const isFirstRow = index === 0

    // Only the first row carries the merged Activity/Task cell; the rest hold a
    // placeholder that layoutRows marks as "continue".
    const activityCell = docCell(
      isFirstRow
        ? {
            text: activityText(schedule.activities),
            rowSpan: officers.length,
            hangingIndent: true,
          }
        : {},
    )

    const branchOne = docCell({ text: branchText(assignment?.one) })
    const branchTwo = docCell({ text: branchText(assignment?.two) })
    const visitOne = docCell({ text: visitText(assignment?.one, 'one') })
    const visitTwo = docCell({ text: visitText(assignment?.two, 'two') })

    for (const windowKey of ['one', 'two'] as const) {
      const length = mergeRuns.get(windowKey)?.get(index)
      if (length) {
        const target = windowKey === 'one' ? branchOne : branchTwo
        target.rowSpan = length
      }
    }

    const cells: DocCell[] = [
      activityCell,
      docCell({ text: printableStaffName(officer, settings.crossMarkTemporaryNames) }),
      branchOne,
      visitOne,
      branchTwo,
      visitTwo,
    ]

    rows.push({ cells })

    const missing = (['one', 'two'] as const).filter(
      (windowKey) => !branchText(assignment?.[windowKey]),
    )
    if (missing.length > 0) {
      exportWarnings.push(
        `${officer.name} has no branch set for ${missing.length === 2 ? 'either window' : `window ${missing[0] === 'one' ? 1 : 2}`}.`,
      )
    }
  })

  if (officers.length === 0) {
    rows.push({
      cells: [
        docCell({
          text: emptyMessage ?? '',
          colSpan: SCHEDULE_COLUMNS.length,
        }),
      ],
    })
  }

  if (officers.length > 0 && schedule.activities.length === 0) {
    exportWarnings.push('The Activity/Task list is empty for this month.')
  }

  return {
    fileBaseName,
    title: settings.organization,
    subtitle: settings.department,
    heading,
    programLine: settings.program,
    columns: SCHEDULE_COLUMNS,
    rows,
    emptyMessage,
    exportWarnings,
  }
}

/** Normalised printable widths as percentages, used by all three renderers. */
export function columnWidthsPercent(columns: DocColumn[]): number[] {
  const total = columns.reduce((sum, column) => sum + column.weight, 0)
  if (total === 0) return columns.map(() => 100 / columns.length)
  return columns.map((column) => (column.weight / total) * 100)
}

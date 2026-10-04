import {
  DEFAULT_ACTIVITIES,
  DEFAULT_PERMANENT_ROSTER,
  emptyMonthSchedule,
  rememberTemporaryName,
  type AppSettings,
  type Assignment,
  type MonthSchedule,
  type Officer,
  type WindowKey,
} from './schema'

export const SAMPLE_MONTH_KEY = '2026-10'

export const SAMPLE_TEMPORARY_NAMES = ['Maydul Islam', 'Iftekharul Islam'] as const

interface SampleRow {
  name: string
  branchOne: string
  branchTwo: string
  customOne?: { start: string; end: string }
}

const SAMPLE_ROWS: SampleRow[] = [
  { name: 'Moyen Uddin', branchOne: 'Mangalpur, Dinajpur', branchTwo: 'Hatrampur, Dinajpur' },
  {
    name: 'Md. Nuruzzaman',
    branchOne: 'Mostofirhat, Lalmonirhat',
    branchTwo: 'Patgram Sadar, Lalmonirhat',
    customOne: { start: '2026-10-04', end: '2026-10-15' },
  },
  { name: 'Kartick Bhowmik', branchOne: 'Pirgonj, Rangpur', branchTwo: 'Paglapir, Rangpur' },
  { name: 'Jamir Uddin', branchOne: 'Dalia, Nilphamari', branchTwo: 'Sayedpur Sadar, Nilphamari' },
  { name: 'Sanchya Sarker', branchOne: 'Mondolerhat, Kurigram', branchTwo: 'Pouroshova (ME), Kurigram' },
  { name: 'Mamunur Rashid', branchOne: 'Jashore Sadar, Jashore', branchTwo: 'Allahrdarga, Chuadanga' },
  { name: 'Rashedul Islam', branchOne: 'Kadirabad, Naogaon', branchTwo: 'Sonatola, Bogura' },
  {
    name: 'Anwarul Islam',
    branchOne: 'Narshingdi Sadar (ME), Narshingdi',
    branchTwo: 'Shalna (ME), Gazipur',
  },
  { name: 'Md. Laku Mia', branchOne: 'Bajitpur, Narshingdi', branchTwo: 'Narshingdi Sadar, Narshingdi' },
]

interface SampleTemporary {
  name: string
  branchOne: string
  branchTwo: string
}

const SAMPLE_TEMPORARIES: SampleTemporary[] = [
  { name: 'Maydul Islam', branchOne: 'Issue-Based Monitoring', branchTwo: 'Naogaon Region' },
  { name: 'Iftekharul Islam', branchOne: 'Issue-Based Monitoring', branchTwo: 'Dinajpur Region' },
]

function assignmentFor(
  branch: string,
  customRanges: Assignment['customRanges'] = [],
): Assignment {
  return { branch, customRanges }
}

function assignmentsFor(one: Assignment, two: Assignment): Record<WindowKey, Assignment> {
  return { one, two }
}

/** Builds the October 2026 sample exactly as described in the brief. */
export function createSampleSchedule(): MonthSchedule {
  const schedule = emptyMonthSchedule(2026, 10)
  schedule.windows = {
    one: { start: '2026-10-04', end: '2026-10-13' },
    two: { start: '2026-10-14', end: '2026-10-27' },
  }
  schedule.activities = [...DEFAULT_ACTIVITIES]

  const officers: Officer[] = []
  const assignments: Record<string, Record<WindowKey, Assignment>> = {}

  DEFAULT_PERMANENT_ROSTER.forEach((name, index) => {
    const officer: Officer = {
      id: `p-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      kind: 'permanent',
      crossedOut: false,
    }
    const row = SAMPLE_ROWS.find((entry) => entry.name === name)
    officers.push(officer)
    assignments[officer.id] = assignmentsFor(
      assignmentFor(row?.branchOne ?? '', row?.customOne ? [row.customOne] : []),
      assignmentFor(row?.branchTwo ?? ''),
    )
  })

  SAMPLE_TEMPORARIES.forEach((entry, index) => {
    const officer: Officer = {
      id: `t-${index}-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: entry.name,
      kind: 'temporary',
      crossedOut: false,
    }
    officers.push(officer)
    assignments[officer.id] = assignmentsFor(assignmentFor(entry.branchOne), assignmentFor(entry.branchTwo))
  })

  schedule.officers = officers
  schedule.assignments = assignments
  return schedule
}

export function applySampleMonth(
  settings: AppSettings,
): { settings: AppSettings; schedule: MonthSchedule; monthKey: string } {
  let nextSettings = settings
  for (const name of SAMPLE_TEMPORARY_NAMES) {
    nextSettings = rememberTemporaryName(nextSettings, name)
  }
  return { settings: nextSettings, schedule: createSampleSchedule(), monthKey: SAMPLE_MONTH_KEY }
}

/** Officers a new month inherits: permanent roster plus last month's temporaries. */
export function carryOverOfficers(settings: AppSettings, previous: MonthSchedule | undefined): Officer[] {
  const permanent: Officer[] = settings.defaultPermanentRoster
    .filter((name) => name.trim() !== '')
    .map((name, index) => ({
      id: `p-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: name.trim(),
      kind: 'permanent' as const,
      crossedOut: false,
    }))

  const temporary: Officer[] = (previous?.officers ?? [])
    .filter((officer) => officer.kind === 'temporary')
    .map((officer, index) => ({
      id: `carry-${index}-${officer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: officer.name,
      kind: 'temporary' as const,
      crossedOut: false,
    }))

  return [...permanent, ...temporary]
}

/**
 * "Start from last month" carries the activity list and the temporary officers
 * over, and clears every branch and custom date.
 */
export function createCarriedSchedule(
  settings: AppSettings,
  previous: MonthSchedule | undefined,
  year: number,
  month: number,
  windows: MonthSchedule['windows'],
): MonthSchedule {
  const schedule = emptyMonthSchedule(year, month)
  schedule.windows = windows
  schedule.activities = previous && previous.activities.length > 0
    ? [...previous.activities]
    : [...DEFAULT_ACTIVITIES]

  const officers = carryOverOfficers(settings, previous)
  schedule.officers = officers
  const assignments: Record<string, Record<WindowKey, Assignment>> = {}
  for (const officer of officers) {
    assignments[officer.id] = { one: assignmentFor(''), two: assignmentFor('') }
  }
  schedule.assignments = assignments
  return schedule
}
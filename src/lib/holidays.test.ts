import { describe, expect, it } from 'vitest'

import { buildHolidayPrompt, describePromptScope, mergeHoliday, parseHolidayInput, rowsToHolidays, stripJsonFences } from './holidays'

const CLEAN = `{"year": 2026, "holidays": [
  {"date": "2026-02-15", "name": "Martyrs' Day", "nameBn": "শহীদ দিবস", "tentative": false},
  {"date": "2026-03-21", "name": "Eid-ul-Fitr", "nameBn": "ঈদুল ফিতর", "tentative": true},
  {"date": "2026-10-02", "name": "Eid-ul-Fitr (2nd day)", "nameBn": "ঈদুল ফিতর"}
]}`

describe('stripping markdown fences', () => {
  it('removes a fenced block and its language tag', () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(stripJsonFences('```\n[1,2]\n```')).toBe('[1,2]')
  })

  it('leaves bare JSON alone', () => {
    expect(stripJsonFences('  {"a":1}  ')).toBe('{"a":1}')
  })

  it('drops an unterminated fence', () => {
    expect(stripJsonFences('```json\n{"a":1}')).toBe('{"a":1}')
  })
})

describe('parsing clean assistant output', () => {
  it('reads every holiday with all four fields', () => {
    const rows = parseHolidayInput(CLEAN)
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.valid)).toBe(true)
    expect(rows[0]).toMatchObject({
      date: '2026-02-15',
      nameEn: "Martyrs' Day",
      nameBn: 'শহীদ দিবস',
      tentative: false,
    })
    expect(rows[1]).toMatchObject({ date: '2026-03-21', tentative: true })
    expect(rows[2]?.nameEn).toBe('Eid-ul-Fitr (2nd day)')
  })

  it('turns the rows into holidays keyed by date', () => {
    const holidays = rowsToHolidays(parseHolidayInput(CLEAN))
    expect(Object.keys(holidays).sort()).toEqual(['2026-02-15', '2026-03-21', '2026-10-02'])
    expect(holidays['2026-03-21']).toEqual({
      source: 'imported',
      nameEn: 'Eid-ul-Fitr',
      nameBn: 'ঈদুল ফিতর',
      tentative: true,
    })
    // An absent optional field stays absent rather than becoming undefined.
    expect(holidays['2026-10-02']).toEqual({ source: 'imported', nameEn: 'Eid-ul-Fitr (2nd day)', nameBn: 'ঈদুল ফিতর' })
  })
})

describe('tolerating the shapes assistants actually produce', () => {
  it('accepts markdown fences around the JSON', () => {
    const rows = parseHolidayInput(`Sure, here you go:\n\n\`\`\`json\n${CLEAN}\n\`\`\`\n`)
    expect(rows.filter((row) => row.valid)).toHaveLength(3)
  })

  it('accepts prose before and after the JSON', () => {
    const rows = parseHolidayInput(`Here is the list:\n${CLEAN}\nLet me know if you need more.`)
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.valid)).toBe(true)
  })

  it('accepts a bare list of holidays with no wrapper', () => {
    const rows = parseHolidayInput('[{"date":"2026-01-01","name":"New Year"}]')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.valid).toBe(true)
    expect(rows[0]?.date).toBe('2026-01-01')
  })

  it('accepts alternative date field names', () => {
    const input = JSON.stringify({
      year: 2026,
      list: [
        { isoDate: '2026-04-12', englishName: 'Eid-ul-Fitr', bengaliName: 'ঈদুল ফিতর', isTentative: 'yes' },
        { day: '2026-05-01', title: 'May Day', bn: 'মে দিবস' },
      ],
    })
    const rows = parseHolidayInput(input)
    expect(rows.map((row) => row.date)).toEqual(['2026-04-12', '2026-05-01'])
    expect(rows[0]).toMatchObject({ nameEn: 'Eid-ul-Fitr', nameBn: 'ঈদুল ফিতর', tentative: true })
    expect(rows[1]).toMatchObject({ nameEn: 'May Day', nameBn: 'মে দিবস', tentative: false })
  })

  it('accepts a date-keyed object', () => {
    const rows = parseHolidayInput('{"2026-08-17":"Independence Day","2026-12-16":"Victory Day"}')
    expect(rows.map((row) => row.date)).toEqual(['2026-08-17', '2026-12-16'])
    expect(rows[0]?.nameEn).toBe('Independence Day')
  })

  it('accepts a single holiday object', () => {
    const rows = parseHolidayInput('{"date":"2026-06-01","name":"One holiday"}')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.date).toBe('2026-06-01')
  })

  it('accepts slash-separated and long-form dates', () => {
    const rows = parseHolidayInput('[{"date":"2026/07/05","name":"A"},{"date":"6 July 2026","name":"B"}]')
    expect(rows.map((row) => row.date)).toEqual(['2026-07-05', '2026-07-06'])
  })

  it('accepts a plain list of date strings', () => {
    const rows = parseHolidayInput('["2026-01-01", "2026-01-02"]')
    expect(rows.map((row) => row.date)).toEqual(['2026-01-01', '2026-01-02'])
  })

  it('defaults a missing English name rather than dropping the row', () => {
    const rows = parseHolidayInput('[{"date":"2026-07-05"}]')
    expect(rows[0]).toMatchObject({ valid: true, nameEn: 'Holiday' })
  })
})

describe('reporting invalid rows instead of guessing', () => {
  it('marks an unparseable date invalid and explains why', () => {
    const rows = parseHolidayInput('[{"date":"2026-02-31","name":"Impossible"},{"date":"2026-02-28","name":"Fine"}]')
    expect(rows[0]).toMatchObject({ valid: false, date: null })
    expect(rows[0]?.error).toContain('2026-02-31')
    expect(rows[1]?.valid).toBe(true)
  })

  it('marks a row with no date field invalid', () => {
    const rows = parseHolidayInput('[{"name":"No date here"}]')
    expect(rows[0]?.valid).toBe(false)
    expect(rows[0]?.error).toContain('No date field')
  })

  it('marks a row that is not an object or string invalid', () => {
    const rows = parseHolidayInput('[42, {"date":"2026-01-01","name":"Ok"}]')
    expect(rows[0]?.valid).toBe(false)
    expect(rows[1]?.valid).toBe(true)
  })

  it('reports unparseable text in plain language', () => {
    const rows = parseHolidayInput('sorry, I cannot help with that')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.valid).toBe(false)
    expect(rows[0]?.error).toContain('No JSON')
  })

  it('reports broken JSON in plain language', () => {
    const rows = parseHolidayInput('{"holidays": [ {"date": "2026-01-01", } ]}')
    expect(rows[0]?.valid).toBe(false)
    expect(rows[0]?.error).toContain('could not be parsed')
  })

  it('reports an empty list', () => {
    const rows = parseHolidayInput('{"year": 2026, "holidays": []}')
    expect(rows[0]?.error).toContain('No holiday list')
  })

  it('returns nothing for empty input', () => {
    expect(parseHolidayInput('')).toEqual([])
    expect(parseHolidayInput('   ')).toEqual([])
  })

  it('keeps valid rows even when others fail', () => {
    const holidays = rowsToHolidays(
      parseHolidayInput('[{"date":"bogus","name":"Bad"},{"date":"2026-03-26","name":"Good","nameBn":"ঈদ"}]'),
    )
    expect(Object.keys(holidays)).toEqual(['2026-03-26'])
  })
})

describe('merging an import into the existing store', () => {
  it('adds a new date', () => {
    const existing = undefined
    expect(mergeHoliday(existing, { source: 'imported', nameEn: 'New' })).toEqual({
      source: 'imported',
      nameEn: 'New',
    })
  })

  it('refreshes the name of an imported holiday', () => {
    const merged = mergeHoliday(
      { source: 'imported', nameEn: 'Old name' },
      { source: 'imported', nameEn: 'Corrected name' },
    )
    expect(merged.nameEn).toBe('Corrected name')
  })

  it('never overwrites a manual holiday', () => {
    const manual = { source: 'manual' as const, nameEn: 'Office closed' }
    expect(mergeHoliday(manual, { source: 'imported', nameEn: 'Eid' })).toBe(manual)
  })
})

describe('the copy prompt', () => {
  it('names the requested month', () => {
    expect(describePromptScope({ kind: 'month', year: 2026, month: 10 })).toBe('October 2026')
    expect(describePromptScope({ kind: 'month', year: 2026, month: 9 })).toBe('September 2026')
  })

  it('names the requested year', () => {
    expect(describePromptScope({ kind: 'year', year: 2026, month: 10 })).toBe('the whole year 2026')
  })

  it('includes every rule the brief requires', () => {
    const prompt = buildHolidayPrompt({ kind: 'month', year: 2026, month: 10 })
    expect(prompt).toContain('সরকারি ছুটি')
    expect(prompt).toContain('October 2026')
    // Multi-day holidays listed day by day.
    expect(prompt).toMatch(/every single day of a multi-day holiday as its own separate date/i)
    // Friday and Saturday holidays kept.
    expect(prompt).toMatch(/Friday or Saturday/i)
    // Tentative flag for moon-sighting holidays.
    expect(prompt).toMatch(/tentative/i)
    // JSON only, no fences.
    expect(prompt).toMatch(/Reply with JSON only/i)
    expect(prompt).toMatch(/no markdown code fences/i)
    // The structure described in words.
    expect(prompt).toMatch(/numeric "year" field and a "holidays" field that is a list/)
    expect(prompt).toMatch(/year-month-day with zero padding/)
    expect(prompt).toContain('"nameBn"')
    expect(prompt).toContain('"tentative"')
  })

  it('changes with the scope it is asked for', () => {
    const monthly = buildHolidayPrompt({ kind: 'month', year: 2027, month: 4 })
    const yearly = buildHolidayPrompt({ kind: 'year', year: 2027, month: 4 })
    expect(monthly).toContain('April 2027')
    expect(yearly).toContain('the whole year 2027')
    expect(monthly).not.toBe(yearly)
  })

  it('only offers the example date that matches the requested month', () => {
    expect(buildHolidayPrompt({ kind: 'month', year: 2026, month: 4 })).toContain('"year": 2026')
    expect(buildHolidayPrompt({ kind: 'year', year: 2031, month: 4 })).toContain('"year": 2026')
  })
})
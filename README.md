# Monitoring Schedule Planner

A client-side planner for the RDRS Bangladesh MEL Department monthly **Monitoring
Schedule** for the Microfinance Program. Nine permanent monitoring officers each
visit two branches a month, one branch per visit window, and one or two temporary
officers join for issue-based or regional visits.

The app replaces editing the sheet by hand in Word: you plan the month on a large
interactive calendar and export it as a PDF or an editable Word document that
reproduces the existing paper format.

Everything runs in the browser. There is no backend, no database, no login and no
environment variables.

---

## Setup

Requires Node.js 20.19 or newer (Node 24 recommended).

```bash
npm install
npm run dev          # http://localhost:5173
```

### Scripts

| Script            | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Development server with hot reload                      |
| `npm run build`   | Typecheck, then build the static site into `dist/`      |
| `npm run preview` | Serve the production build locally                      |
| `npm run lint`    | Run oxlint over the source                              |
| `npm run typecheck` | Run the TypeScript compiler without emitting          |
| `npm test`        | Run the Vitest unit tests once                          |
| `npm run test:watch` | Run the tests in watch mode                         |

---

## Deploying to Vercel

The project is already a static site, so no configuration is needed.

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`

Push the repository to Git, import it at [vercel.com/new](https://vercel.com/new),
and Vercel detects the settings above. No environment variables and no serverless
functions are required, because all data lives in the browser.

Any other static host works too. `npm run build` emits a plain `dist/` folder with
relative asset paths; serve it with any file server.

---

## How to plan a month

1. Pick a month with the arrows or the month and year pickers in the top bar.
2. A month you have never used offers three starting points:
   - **Start from last month** carries the activity list and the temporary officers
     over and clears every branch and custom date.
   - **Start blank** gives you the nine permanent officers and the default windows.
   - **Load sample: October 2026** fills in a complete worked example.
3. Adjust the two visit windows by dragging a band, or by typing exact dates in the
   inputs above the calendar. The badge under the inputs always shows the working-day
   count for each window.
4. Fill in the branch names on the **Assignments** tab. Branch cells autocomplete from
   the names you have used before.
5. Write the activity list on the **Activities** tab.
6. Check the **Preview** tab, then export PDF or Word.

### The calendar

Weeks start on Sunday, so Friday and Saturday are the two right-most columns.

| Cell state                    | Meaning                                       |
| ----------------------------- | --------------------------------------------- |
| Plain                         | Working day                                   |
| Hatched and muted             | Weekly off day                                |
| Red with the holiday name     | Government holiday (imported)                 |
| Red with a corner dot         | Manual holiday set by clicking the date       |
| Ringed in window-one colour   | Working-day override on a weekly off day      |

Clicking a date walks through those states and offers an undo toast. If a click turns a
day into a holiday that a window edge was resting on, the edge snaps to the nearest
working day and the toast says so.

Hovering a holiday shows its full English name, the Bengali name, and whether it was
imported or set by hand.

### Export options

Three settings change what the printed sheet looks like:

- **Merge identical adjacent temporary branch cells** reproduces the September sheet
  where two temporary officers shared one "Issue-Based Monitoring" cell.
- **Show a cross mark beside temporary names** prints `× Maydul Islam`.
- **Split displayed date ranges around holidays** turns `05-16 July` into
  `05-09 & 11-16 July`. It is off by default because the paper sheets print a
  continuous range.

### Printed date format

Two-digit day, hyphen, two-digit day, then the month name, for example
`04-13 October`. A single day prints as `05 July`. Several ranges are joined with
`& ` and the month name appears once at the end, so `05-16 July` and `26-28 July`
print as `05-16 & 26-28 July`. September is abbreviated to `Sept`, as on the paper.

---

## The holiday import workflow

Holidays are never counted as working days, window ends cannot rest on them, and the
working-day counts in the window badges reflect them.

1. Open the **Holidays** tab.
2. Choose **This month only** or **The whole year**.
3. Press **Copy prompt**. The clipboard receives a ready-to-use prompt that names the
   month and year you chose. If the browser blocks clipboard access the prompt opens in
   a dialog, already selected, so you can copy it by hand.
4. Paste the prompt into an AI assistant that can browse the web. It is written to
   return JSON only, to list every day of a multi-day holiday separately, to keep
   holidays that fall on a Friday or Saturday, to mark moon-sighting-dependent dates as
   tentative, and to describe the JSON shape in words.
5. Press **Import JSON** and paste what came back.
6. The parser is deliberately forgiving. It strips markdown fences and surrounding
   prose, accepts a bare list of holidays or a date-keyed object, and understands
   alternative field names such as `isoDate`, `englishName`, `bengaliName` and
   `isTentative`. Every date is validated.
7. The review step lists valid rows with checkboxes and invalid rows with the reason.
   Tick what you want and press **Apply**.
8. Importing only ever merges. Holidays in other months are kept, dates you set by
   hand are never overwritten, and names on dates that already exist are refreshed.

You can also click dates on the calendar to set holidays by hand. Those are marked
differently and take priority over imported ones.

---

## Storage: why localStorage

The whole dataset is a few kilobytes per month, it belongs to one person, and the app
has to keep working with no network at all, so it is kept in `localStorage` rather than a
server. That means the data is per browser and per device: it does not follow you to
another machine, it is not shared with colleagues, and clearing site data deletes it.
Every storage access is wrapped so a full or unavailable store degrades to in-memory
work with a persistent warning banner rather than crashing, writes are debounced behind
an "All changes saved" indicator, and records carry a schema version that is migrated on
load. The backup exists for exactly that reason: **Download backup** writes every month,
the holiday list and the settings to one JSON file, **Restore backup** reads it back on
any machine, and **Reset all data** clears everything behind a confirmation.

### Keys

| Key                        | Holds                                    |
| -------------------------- | ---------------------------------------- |
| `msp:settings`             | App settings and the recent-name memories |
| `msp:holidays`             | The global holiday list                   |
| `msp:month:YYYY-MM`        | One record per month                      |
| `msp:meta`                 | The schema version currently in use       |

---

## How the code is organised

All the date and schedule logic is pure and lives in `src/lib`, away from React.

| File                                | Responsibility                                     |
| ----------------------------------- | -------------------------------------------------- |
| `date.ts`                           | ISO date helpers. Dates are plain calendar dates and never pass through UTC. |
| `date-format.ts`                    | The printed date text, including `05-16 & 26-28 July`. |
| `working-days.ts`                   | Day status, working-day counting, snapping, defaults. |
| `holidays.ts`                       | The tolerant holiday parser and the copy prompt.    |
| `schedule-ops.ts`                   | Moving, shifting and re-snapping the visit windows; warnings. |
| `schema.ts`                         | Types, defaults and the seed roster.                |
| `seed.ts`                           | The October 2026 sample.                            |
| `storage.ts`                        | Key names, the versioned schema, migrations, backups. |
| `storage-adapter.ts`                | The defensive `localStorage` wrapper.               |
| `document-model.ts`                 | The one table that the preview, the PDF and Word all render. |
| `export-pdf.ts` / `export-docx.ts`  | The two generators.                                 |

The reducer in `src/state/planner-reducer.ts` is a pure function of
`(state, action)`, and `usePlannerPersistence` is the only place that touches storage.

### Why one document model

`buildDocumentModel` turns planner state into a plain table of cells. The Preview tab,
the PDF and the Word file all render that same table, so what you see on screen is what
lands in the file. Vertical merges are described once, with a `rowSpan`, and each
renderer turns it into its own mechanism.

---

## Dates never go through UTC

Every date is a plain calendar date held as an ISO `YYYY-MM-DD` string and converted with
local-time constructors. Nothing calls `toISOString()` or parses a date as UTC, so there
is no timezone offset that can move an officer's visit onto the wrong day.

## Accessibility and responsiveness

Every control is reachable by keyboard and has a visible focus ring. Dragging always has
a button or input alternative: officers and activities have arrow buttons and a keyboard
sensor, branch cells can be swapped by typing, and window edges have exact date inputs.
The layout collapses to a single column on a phone, where the calendar keeps the whole
width. Light and dark themes both come from the shadcn theme tokens.

## Tests

`npm test` runs 157 unit tests covering the parts where an off-by-one error would be
invisible on screen:

- `src/lib/date-format.test.ts` — the printed date text, ISO round-trips, leap years,
  28 to 31 day months, the Sunday-first calendar grid, and year boundaries.
- `src/lib/working-days.test.ts` — working-day counting, snapping to the nearest working
  day, the day-status cycle, default windows, and splitting ranges around holidays.
- `src/lib/holidays.test.ts` — the tolerant parser against fences, prose, alternative
  field names and invalid rows, plus the contents of the copy prompt.
- `src/lib/document-model.test.ts` — the shared document model, merged cells, the export
  options, and moving, shifting and re-snapping the visit windows.
- `src/lib/export.test.ts` — both generators, including pagination.
- `src/hooks/use-planner-persistence.test.ts` — the storage migration hook, debounced
  writes, per-month keys, a full store, an unavailable store, and the backup round trip.
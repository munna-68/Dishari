import { it } from 'vitest'
import { createSampleSchedule } from './seed'
import { resnapWindows, setWindow, shiftDateByWorkingDays } from './schedule-ops'
import { countWorkingDays, defaultWindows, isWorkingDay, snapToWorkingDay, workingDaysInMonth } from './working-days'
import type { HolidayContext } from './working-days'

function ctxWith(iso: string[]): HolidayContext {
  const holidays: Record<string, { source: 'manual'; nameEn: string }> = {}
  for (const d of iso) holidays[d] = { source: 'manual', nameEn: 'Manual holiday' }
  return { holidays, workingOverrides: {}, weeklyOffDays: [5, 6] }
}

it('probe', () => {
  const s = createSampleSchedule()
  console.log('start', JSON.stringify(s.windows))
  const c1 = ctxWith(['2026-10-07', '2026-10-13'])
  const r = resnapWindows(s, '2026-10', c1)
  console.log('resnap ->', JSON.stringify(r.windows), r.message)
  const direct = setWindow(s, 'one', { start: '2026-10-04', end: '2026-10-14' }, '2026-10', c1)
  console.log('setWindow one ->', JSON.stringify(direct.windows), direct.message)
  console.log('count 14..27 =', countWorkingDays('2026-10-14', '2026-10-27', c1))
  console.log('workingDays 15..27 =', workingDaysInMonth(2026, 10, c1).filter(d => d >= '2026-10-14' && d <= '2026-10-27').join(','))
  console.log('isWorking 15 =', isWorkingDay('2026-10-15', c1), 'isWorking 16 =', isWorkingDay('2026-10-16', c1))
  console.log('snap 14 forward =', snapToWorkingDay('2026-10-14', c1, 'forward'))
  const b = { min: '2026-10-01', max: '2026-10-31' }
  console.log('snap 13 nearest =', snapToWorkingDay('2026-10-13', c1, 'nearest', b))
  console.log('snap 31 backward =', snapToWorkingDay('2026-10-31', c1, 'backward', b))
  const sc = structuredClone(s)
  sc.windows.one = { start: '2026-10-04', end: '2026-10-14' }
  const r2 = setWindow(sc, 'two', { start: '2026-10-15', end: '2026-10-27' }, '2026-10', c1)
  console.log('set two 15-27 ->', JSON.stringify(r2.windows), r2.message)
  console.log('shift 14 +10 =', shiftDateByWorkingDays('2026-10-14', 10, c1))
  console.log('shift 15 +9 =', shiftDateByWorkingDays('2026-10-15', 9, c1))

})

/** Legend entries live next to the classes they describe so they cannot drift. */
export const DAY_LEGEND = [
  { key: 'working', label: 'Working day', swatch: 'bg-blue-500 border-0' },
  { key: 'weekly-off', label: 'Weekly off day', swatch: 'bg-slate-300 dark:bg-slate-600 border-0' },
  { key: 'holiday', label: 'Government holiday', swatch: 'bg-red-500 border-0' },
  { key: 'manual', label: 'Manual holiday', swatch: 'bg-orange-500 border-0' },
  { key: 'override', label: 'Working-day override', swatch: 'bg-emerald-500 border-0' },
  { key: 'officer', label: 'Selected officer', swatch: 'bg-slate-500 dark:bg-slate-400 border-0' },
] as const


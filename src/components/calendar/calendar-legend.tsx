/** Legend entries live next to the classes they describe so they cannot drift. */
export const DAY_LEGEND = [
  { key: 'working', label: 'Working day', swatch: 'bg-card border' },
  { key: 'weekly-off', label: 'Weekly off day', swatch: 'bg-weekend offday-hatch border' },
  { key: 'holiday', label: 'Government holiday', swatch: 'bg-holiday-soft border-holiday' },
  { key: 'manual', label: 'Manual holiday', swatch: 'bg-holiday border-holiday' },
  { key: 'override', label: 'Working-day override', swatch: 'bg-card border ring-1 ring-window-one/50' },
  { key: 'officer', label: 'Selected officer', swatch: 'h-1 w-4 rounded-full bg-primary/80 border-0' },
] as const

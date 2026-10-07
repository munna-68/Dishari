export interface OfficerColorTheme {
  id: string
  name: string
  // Avatar styling
  avatarBg: string
  avatarText: string
  avatarBorder: string
  // Dot / indicator
  dotBg: string
  borderAccent: string
  // Soft badge / pill styling
  badgeBg: string
  badgeText: string
  badgeBorder: string
}

export const OFFICER_COLOR_PALETTE: OfficerColorTheme[] = [
  // 0: Blue (Moynul Uddin in mockup)
  {
    id: 'blue',
    name: 'Blue',
    avatarBg: 'bg-blue-100 dark:bg-blue-950/80',
    avatarText: 'text-blue-700 dark:text-blue-300',
    avatarBorder: 'border-blue-200 dark:border-blue-800',
    dotBg: 'bg-blue-500',
    borderAccent: 'border-l-blue-500',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/50',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200/80 dark:border-blue-800/80',
  },
  // 1: Purple (Md. Nuruzzaman in mockup)
  {
    id: 'purple',
    name: 'Purple',
    avatarBg: 'bg-purple-100 dark:bg-purple-950/80',
    avatarText: 'text-purple-700 dark:text-purple-300',
    avatarBorder: 'border-purple-200 dark:border-purple-800',
    dotBg: 'bg-purple-500',
    borderAccent: 'border-l-purple-500',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/50',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200/80 dark:border-purple-800/80',
  },
  // 2: Emerald/Mint (Kartick Bhowmik in mockup)
  {
    id: 'emerald',
    name: 'Emerald',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    avatarText: 'text-emerald-700 dark:text-emerald-300',
    avatarBorder: 'border-emerald-200 dark:border-emerald-800',
    dotBg: 'bg-emerald-500',
    borderAccent: 'border-l-emerald-500',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200/80 dark:border-emerald-800/80',
  },
  // 3: Amber/Orange (Jamir Uddin in mockup)
  {
    id: 'amber',
    name: 'Amber',
    avatarBg: 'bg-amber-100 dark:bg-amber-950/80',
    avatarText: 'text-amber-800 dark:text-amber-300',
    avatarBorder: 'border-amber-200 dark:border-amber-800',
    dotBg: 'bg-amber-500',
    borderAccent: 'border-l-amber-500',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/50',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-200/80 dark:border-amber-800/80',
  },
  // 4: Pink/Fuchsia (Sanchya Sarker in mockup)
  {
    id: 'pink',
    name: 'Pink',
    avatarBg: 'bg-pink-100 dark:bg-pink-950/80',
    avatarText: 'text-pink-700 dark:text-pink-300',
    avatarBorder: 'border-pink-200 dark:border-pink-800',
    dotBg: 'bg-pink-500',
    borderAccent: 'border-l-pink-500',
    badgeBg: 'bg-pink-50 dark:bg-pink-950/50',
    badgeText: 'text-pink-700 dark:text-pink-300',
    badgeBorder: 'border-pink-200/80 dark:border-pink-800/80',
  },
  // 5: Cyan/Sky (Mamunur Rashid in mockup)
  {
    id: 'cyan',
    name: 'Cyan',
    avatarBg: 'bg-cyan-100 dark:bg-cyan-950/80',
    avatarText: 'text-cyan-800 dark:text-cyan-300',
    avatarBorder: 'border-cyan-200 dark:border-cyan-800',
    dotBg: 'bg-cyan-500',
    borderAccent: 'border-l-cyan-500',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/50',
    badgeText: 'text-cyan-800 dark:text-cyan-300',
    badgeBorder: 'border-cyan-200/80 dark:border-cyan-800/80',
  },
  // 6: Rose (Rashedul Islam in mockup)
  {
    id: 'rose',
    name: 'Rose',
    avatarBg: 'bg-rose-100 dark:bg-rose-950/80',
    avatarText: 'text-rose-700 dark:text-rose-300',
    avatarBorder: 'border-rose-200 dark:border-rose-800',
    dotBg: 'bg-rose-500',
    borderAccent: 'border-l-rose-500',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/50',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200/80 dark:border-rose-800/80',
  },
  // 7: Indigo
  {
    id: 'indigo',
    name: 'Indigo',
    avatarBg: 'bg-indigo-100 dark:bg-indigo-950/80',
    avatarText: 'text-indigo-700 dark:text-indigo-300',
    avatarBorder: 'border-indigo-200 dark:border-indigo-800',
    dotBg: 'bg-indigo-500',
    borderAccent: 'border-l-indigo-500',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/50',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200/80 dark:border-indigo-800/80',
  },
  // 8: Teal
  {
    id: 'teal',
    name: 'Teal',
    avatarBg: 'bg-teal-100 dark:bg-teal-950/80',
    avatarText: 'text-teal-700 dark:text-teal-300',
    avatarBorder: 'border-teal-200 dark:border-teal-800',
    dotBg: 'bg-teal-500',
    borderAccent: 'border-l-teal-500',
    badgeBg: 'bg-teal-50 dark:bg-teal-950/50',
    badgeText: 'text-teal-700 dark:text-teal-300',
    badgeBorder: 'border-teal-200/80 dark:border-teal-800/80',
  },
  // 9: Violet
  {
    id: 'violet',
    name: 'Violet',
    avatarBg: 'bg-violet-100 dark:bg-violet-950/80',
    avatarText: 'text-violet-700 dark:text-violet-300',
    avatarBorder: 'border-violet-200 dark:border-violet-800',
    dotBg: 'bg-violet-500',
    borderAccent: 'border-l-violet-500',
    badgeBg: 'bg-violet-50 dark:bg-violet-950/50',
    badgeText: 'text-violet-700 dark:text-violet-300',
    badgeBorder: 'border-violet-200/80 dark:border-violet-800/80',
  },
  // 10: Orange
  {
    id: 'orange',
    name: 'Orange',
    avatarBg: 'bg-orange-100 dark:bg-orange-950/80',
    avatarText: 'text-orange-700 dark:text-orange-300',
    avatarBorder: 'border-orange-200 dark:border-orange-800',
    dotBg: 'bg-orange-500',
    borderAccent: 'border-l-orange-500',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/50',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-200/80 dark:border-orange-800/80',
  },
  // 11: Lime
  {
    id: 'lime',
    name: 'Lime',
    avatarBg: 'bg-lime-100 dark:bg-lime-950/80',
    avatarText: 'text-lime-800 dark:text-lime-300',
    avatarBorder: 'border-lime-200 dark:border-lime-800',
    dotBg: 'bg-lime-500',
    borderAccent: 'border-l-lime-500',
    badgeBg: 'bg-lime-50 dark:bg-lime-950/50',
    badgeText: 'text-lime-800 dark:text-lime-300',
    badgeBorder: 'border-lime-200/80 dark:border-lime-800/80',
  },
]

const CANONICAL_OFFICER_ROSTER: Record<string, number> = {
  // 0: Blue - Moynul / Moyen Uddin
  'moyen-uddin': 0,
  'moyen uddin': 0,
  'moynul-uddin': 0,
  'moynul uddin': 0,
  // 1: Purple - Md. Nuruzzaman
  'md-nuruzzaman': 1,
  'md. nuruzzaman': 1,
  'md nuruzzaman': 1,
  // 2: Emerald - Kartick Bhowmik
  'kartick-bhowmik': 2,
  'kartick bhowmik': 2,
  // 3: Amber - Jamir / Jamin Uddin
  'jamir-uddin': 3,
  'jamir uddin': 3,
  'jamin-uddin': 3,
  'jamin uddin': 3,
  // 4: Pink - Sanchya Sarker / Sarkar
  'sanchya-sarker': 4,
  'sanchya sarker': 4,
  'sanchya-sarkar': 4,
  'sanchya sarkar': 4,
  // 5: Cyan - Mamunur Rashid
  'mamunur-rashid': 5,
  'mamunur rashid': 5,
  // 6: Rose - Rashedul Islam
  'rashedul-islam': 6,
  'rashedul islam': 6,
  // 7: Indigo - Anwarul Islam
  'anwarul-islam': 7,
  'anwarul islam': 7,
  // 8: Teal - Md. Laku Mia
  'md-laku-mia': 8,
  'md. laku mia': 8,
  'md laku mia': 8,
}

function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
  }
  return Math.abs(hash)
}

export function getOfficerColor(
  officerIdOrIndex: string | number,
  officersList?: Array<{ id: string; name?: string }>,
): OfficerColorTheme {
  if (typeof officerIdOrIndex === 'number') {
    const idx = Math.abs(officerIdOrIndex) % OFFICER_COLOR_PALETTE.length
    return OFFICER_COLOR_PALETTE[idx]!
  }

  // 1. Check canonical roster mapping by ID, slug, or name
  const normKey = officerIdOrIndex.trim().toLowerCase().replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ')
  const slugKey = officerIdOrIndex.trim().toLowerCase().replace(/[.\s_]/g, '-')
  if (CANONICAL_OFFICER_ROSTER[normKey] !== undefined) {
    return OFFICER_COLOR_PALETTE[CANONICAL_OFFICER_ROSTER[normKey]!]!
  }
  if (CANONICAL_OFFICER_ROSTER[slugKey] !== undefined) {
    return OFFICER_COLOR_PALETTE[CANONICAL_OFFICER_ROSTER[slugKey]!]!
  }

  // 2. If officersList is provided, find officer and check their name or position
  if (officersList && officersList.length > 0) {
    const foundIndex = officersList.findIndex((o) => o.id === officerIdOrIndex)
    if (foundIndex >= 0) {
      const officerObj = officersList[foundIndex]
      if (officerObj?.name) {
        const objNorm = officerObj.name.trim().toLowerCase().replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ')
        const objSlug = officerObj.name.trim().toLowerCase().replace(/[.\s_]/g, '-')
        if (CANONICAL_OFFICER_ROSTER[objNorm] !== undefined) {
          return OFFICER_COLOR_PALETTE[CANONICAL_OFFICER_ROSTER[objNorm]!]!
        }
        if (CANONICAL_OFFICER_ROSTER[objSlug] !== undefined) {
          return OFFICER_COLOR_PALETTE[CANONICAL_OFFICER_ROSTER[objSlug]!]!
        }
      }
      return OFFICER_COLOR_PALETTE[foundIndex % OFFICER_COLOR_PALETTE.length]!
    }
  }

  const hash = hashString(officerIdOrIndex)
  return OFFICER_COLOR_PALETTE[hash % OFFICER_COLOR_PALETTE.length]!
}

export interface BranchAccentTheme {
  dotBg: string
  borderAccent: string
  borderHover: string
  shadowAccent: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  pillActiveBg: string
  pillActiveText: string
  pillActiveBorder: string
}

export const WINDOW_ONE_BRANCH_ACCENT: BranchAccentTheme = {
  dotBg: 'bg-blue-500 dark:bg-blue-400',
  borderAccent: 'border-l-blue-500 dark:border-l-blue-400',
  borderHover: 'hover:border-blue-300 dark:hover:border-blue-700',
  shadowAccent: 'shadow-[0_2px_8px_-2px_rgba(59,130,246,0.12)] hover:shadow-[0_4px_12px_-2px_rgba(59,130,246,0.2)] dark:shadow-[0_2px_8px_-2px_rgba(59,130,246,0.2)]',
  badgeBg: 'bg-blue-50 dark:bg-blue-950/50',
  badgeText: 'text-blue-700 dark:text-blue-300',
  badgeBorder: 'border-blue-200/80 dark:border-blue-800/80',
  pillActiveBg: 'bg-blue-50/90 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60',
  pillActiveText: 'text-blue-700 dark:text-blue-300',
  pillActiveBorder: 'border-blue-200/90 dark:border-blue-800',
}

export const WINDOW_TWO_BRANCH_ACCENT: BranchAccentTheme = {
  dotBg: 'bg-emerald-500 dark:bg-emerald-400',
  borderAccent: 'border-l-emerald-500 dark:border-l-emerald-400',
  borderHover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  shadowAccent: 'shadow-[0_2px_8px_-2px_rgba(16,185,129,0.12)] hover:shadow-[0_4px_12px_-2px_rgba(16,185,129,0.2)] dark:shadow-[0_2px_8px_-2px_rgba(16,185,129,0.2)]',
  badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50',
  badgeText: 'text-emerald-700 dark:text-emerald-300',
  badgeBorder: 'border-emerald-200/80 dark:border-emerald-800/80',
  pillActiveBg: 'bg-emerald-50/90 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
  pillActiveText: 'text-emerald-700 dark:text-emerald-300',
  pillActiveBorder: 'border-emerald-200/90 dark:border-emerald-800',
}

export const NEUTRAL_BRANCH_ACCENT: BranchAccentTheme = {
  dotBg: 'bg-slate-300 dark:bg-slate-700',
  borderAccent: 'border-l-slate-300 dark:border-l-slate-700',
  borderHover: 'hover:border-slate-300 dark:hover:border-slate-700',
  shadowAccent: 'shadow-2xs',
  badgeBg: 'bg-slate-50 dark:bg-slate-900/50',
  badgeText: 'text-slate-600 dark:text-slate-400',
  badgeBorder: 'border-slate-200 dark:border-slate-800',
  pillActiveBg: 'bg-muted/80',
  pillActiveText: 'text-foreground',
  pillActiveBorder: 'border-border',
}

export function getBranchAccent(
  branch: string,
  windowKey: 'one' | 'two',
  _rowIndex?: number,
): BranchAccentTheme {
  if (!branch || branch.trim() === '') {
    return NEUTRAL_BRANCH_ACCENT
  }
  return windowKey === 'one' ? WINDOW_ONE_BRANCH_ACCENT : WINDOW_TWO_BRANCH_ACCENT
}

export function getOfficerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

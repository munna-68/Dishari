import { cn } from '@/lib/utils'
import { getOfficerColor, getOfficerInitials } from '@/lib/officer-colors'
import type { OfficerKind } from '@/lib/schema'

export interface OfficerAvatarProps {
  officer?: { id?: string; name?: string; crossedOut?: boolean; kind?: OfficerKind } | null
  name?: string
  crossedOut?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function OfficerAvatar({
  officer,
  name,
  crossedOut = false,
  size = 'md',
  className,
}: OfficerAvatarProps) {
  const officerName = name ?? officer?.name ?? ''
  const isCrossedOut = crossedOut || (officer?.crossedOut ?? false)
  const color = getOfficerColor(officer ?? officerName)
  const initials = getOfficerInitials(officerName)

  const sizeClasses = {
    xs: 'size-6 text-[10px]',
    sm: 'size-7 text-[11px]',
    md: 'size-8 text-xs',
    lg: 'size-9 text-sm',
  }[size]

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold border transition-colors select-none shadow-2xs',
        sizeClasses,
        color.avatarBg,
        color.avatarText,
        color.avatarBorder,
        isCrossedOut && 'line-through opacity-70',
        className,
      )}
    >
      {initials}
    </span>
  )
}

export interface OfficerKindBadgeProps {
  kind: OfficerKind
  crossedOut?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function OfficerKindBadge({
  kind,
  crossedOut = false,
  size = 'md',
  className,
}: OfficerKindBadgeProps) {
  const isSmall = size === 'sm'

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {kind === 'permanent' ? (
        <span
          className={cn(
            'inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
            isSmall ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]',
          )}
        >
          Permanent
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex items-center rounded-full border border-sky-200/70 bg-sky-50 font-medium text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-300',
            isSmall ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]',
          )}
        >
          Temporary
        </span>
      )}
      {crossedOut ? (
        <span
          className={cn(
            'inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300',
            isSmall ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]',
          )}
        >
          Left out of table
        </span>
      ) : null}
    </div>
  )
}

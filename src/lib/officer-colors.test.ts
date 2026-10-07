import { describe, expect, it } from 'vitest'
import {
  OFFICER_COLOR_PALETTE,
  getBranchAccent,
  getOfficerColor,
  getOfficerInitials,
  NEUTRAL_BRANCH_ACCENT,
} from './officer-colors'

describe('officer-colors system', () => {
  it('maps officers to the palette by index matching the mockup sequence', () => {
    // Index 0: Blue
    const color0 = getOfficerColor(0)
    expect(color0.id).toBe('blue')
    expect(color0.avatarBg).toContain('bg-blue-100')

    // Index 1: Purple
    const color1 = getOfficerColor(1)
    expect(color1.id).toBe('purple')
    expect(color1.avatarBg).toContain('bg-purple-100')

    // Index 2: Emerald
    const color2 = getOfficerColor(2)
    expect(color2.id).toBe('emerald')

    // Index 3: Amber
    const color3 = getOfficerColor(3)
    expect(color3.id).toBe('amber')

    // Index 4: Pink
    const color4 = getOfficerColor(4)
    expect(color4.id).toBe('pink')

    // Index 5: Cyan
    const color5 = getOfficerColor(5)
    expect(color5.id).toBe('cyan')

    // Index 6: Rose
    const color6 = getOfficerColor(6)
    expect(color6.id).toBe('rose')
  })

  it('maps canonical roster officers deterministically across names, slugs, and lists', () => {
    // By slug
    expect(getOfficerColor('moyen-uddin').id).toBe('blue')
    expect(getOfficerColor('md-nuruzzaman').id).toBe('purple')
    expect(getOfficerColor('kartick-bhowmik').id).toBe('emerald')
    expect(getOfficerColor('jamir-uddin').id).toBe('amber')
    expect(getOfficerColor('sanchya-sarker').id).toBe('pink')
    expect(getOfficerColor('mamunur-rashid').id).toBe('cyan')
    expect(getOfficerColor('rashedul-islam').id).toBe('rose')

    // By name
    expect(getOfficerColor('Moyen Uddin').id).toBe('blue')
    expect(getOfficerColor('Md. Nuruzzaman').id).toBe('purple')
    expect(getOfficerColor('Kartick Bhowmik').id).toBe('emerald')

    // In a list with names
    const list = [
      { id: 'custom-1', name: 'Md. Nuruzzaman' },
      { id: 'custom-2', name: 'Moyen Uddin' },
    ]
    expect(getOfficerColor('custom-1', list).id).toBe('purple')
    expect(getOfficerColor('custom-2', list).id).toBe('blue')
  })

  it('maps officer by id and officersList to the deterministic index when not canonical', () => {
    const list = [{ id: 'off-1' }, { id: 'off-2' }, { id: 'off-3' }]
    expect(getOfficerColor('off-1', list).id).toBe('blue')
    expect(getOfficerColor('off-2', list).id).toBe('purple')
    expect(getOfficerColor('off-3', list).id).toBe('emerald')
  })

  it('falls back to string hashing when officersList is not provided and officer is unknown', () => {
    const c1 = getOfficerColor('completely-unknown-officer-id-xyz')
    const c2 = getOfficerColor('completely-unknown-officer-id-xyz')
    expect(c1.id).toBe(c2.id)
    expect(OFFICER_COLOR_PALETTE.some((p) => p.id === c1.id)).toBe(true)
  })

  it('generates accurate officer initials', () => {
    expect(getOfficerInitials('Moyen Uddin')).toBe('MU')
    expect(getOfficerInitials('Md. Nuruzzaman')).toBe('MN')
    expect(getOfficerInitials('Kartick Bhowmik')).toBe('KB')
    expect(getOfficerInitials('Single')).toBe('S')
    expect(getOfficerInitials('   ')).toBe('?')
    expect(getOfficerInitials('First Middle Last')).toBe('FL')
  })

  it('handles branch accents correctly and correlates with window keys', () => {
    // Empty branch returns neutral
    expect(getBranchAccent('', 'one')).toEqual(NEUTRAL_BRANCH_ACCENT)
    expect(getBranchAccent('   ', 'two')).toEqual(NEUTRAL_BRANCH_ACCENT)

    // Window 1 branches correlate with window one (blue theme)
    const w1 = getBranchAccent('Mangalpur, Dinajpur', 'one')
    expect(w1.dotBg).toContain('bg-blue-500')
    expect(w1.borderAccent).toContain('border-l-blue-500')

    // Window 2 branches correlate with window two (emerald theme)
    const w2 = getBranchAccent('Hatrampur, Dinajpur', 'two')
    expect(w2.dotBg).toContain('bg-emerald-500')
    expect(w2.borderAccent).toContain('border-l-emerald-500')

    // Consistent across multiple calls
    expect(getBranchAccent('Lalmonirhat', 'one')).toEqual(w1)
    expect(getBranchAccent('Lalmonirhat', 'two')).toEqual(w2)
  })
})

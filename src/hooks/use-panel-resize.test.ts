import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  usePanelResize,
  DEFAULT_OFFICERS_PANEL_WIDTH,
  MIN_OFFICERS_PANEL_WIDTH,
  MAX_OFFICERS_PANEL_WIDTH,
} from './use-panel-resize'

describe('usePanelResize', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('initializes with default width and uncollapsed state', () => {
    const { result } = renderHook(() => usePanelResize())
    expect(result.current.width).toBe(DEFAULT_OFFICERS_PANEL_WIDTH)
    expect(result.current.isCollapsed).toBe(false)
  })

  it('restores stored width and collapsed state from localStorage', () => {
    window.localStorage.setItem('dishari:officers-panel:width', '380')
    window.localStorage.setItem('dishari:officers-panel:collapsed', 'true')

    const { result } = renderHook(() => usePanelResize())
    expect(result.current.width).toBe(380)
    expect(result.current.isCollapsed).toBe(true)
  })

  it('toggles collapsed state and updates localStorage', () => {
    const { result } = renderHook(() => usePanelResize())
    expect(result.current.isCollapsed).toBe(false)

    act(() => {
      result.current.toggleCollapsed()
    })
    expect(result.current.isCollapsed).toBe(true)
    expect(window.localStorage.getItem('dishari:officers-panel:collapsed')).toBe('true')

    act(() => {
      result.current.setIsCollapsed(false)
    })
    expect(result.current.isCollapsed).toBe(false)
    expect(window.localStorage.getItem('dishari:officers-panel:collapsed')).toBe('false')
  })

  it('resets width to default on handleResetWidth', () => {
    const { result } = renderHook(() => usePanelResize())

    act(() => {
      result.current.setWidth(450)
    })
    expect(result.current.width).toBe(450)
    expect(window.localStorage.getItem('dishari:officers-panel:width')).toBe('450')

    act(() => {
      result.current.handleResetWidth()
    })
    expect(result.current.width).toBe(DEFAULT_OFFICERS_PANEL_WIDTH)
    expect(window.localStorage.getItem('dishari:officers-panel:width')).toBe(
      String(DEFAULT_OFFICERS_PANEL_WIDTH),
    )
  })

  it('handles keyboard navigation for resizing and collapsing', () => {
    const { result } = renderHook(() => usePanelResize())

    // ArrowLeft shrinks by 16px
    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowLeft',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    expect(result.current.width).toBe(DEFAULT_OFFICERS_PANEL_WIDTH - 16)

    // ArrowRight widens by 16px
    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowRight',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    expect(result.current.width).toBe(DEFAULT_OFFICERS_PANEL_WIDTH)

    // Home key jumps to minimum width
    act(() => {
      result.current.handleKeyDown({
        key: 'Home',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    expect(result.current.width).toBe(MIN_OFFICERS_PANEL_WIDTH)

    // End key jumps to maximum width
    act(() => {
      result.current.handleKeyDown({
        key: 'End',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    expect(result.current.width).toBe(MAX_OFFICERS_PANEL_WIDTH)

    // Enter toggles collapse
    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })
    expect(result.current.isCollapsed).toBe(true)
  })
})

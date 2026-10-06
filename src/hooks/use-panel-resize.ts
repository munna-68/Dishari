import { useCallback, useEffect, useRef, useState } from 'react'

export interface PanelResizeOptions {
  storageKeyWidth?: string
  storageKeyCollapsed?: string
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  containerRef?: React.RefObject<HTMLElement | null>
}

export const DEFAULT_OFFICERS_PANEL_WIDTH = 304 // 19rem
export const MIN_OFFICERS_PANEL_WIDTH = 240
export const MAX_OFFICERS_PANEL_WIDTH = 640

export function usePanelResize({
  storageKeyWidth = 'dishari:officers-panel:width',
  storageKeyCollapsed = 'dishari:officers-panel:collapsed',
  defaultWidth = DEFAULT_OFFICERS_PANEL_WIDTH,
  minWidth = MIN_OFFICERS_PANEL_WIDTH,
  maxWidth = MAX_OFFICERS_PANEL_WIDTH,
  containerRef,
}: PanelResizeOptions = {}) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultWidth
    try {
      const raw = window.localStorage.getItem(storageKeyWidth)
      if (raw) {
        const parsed = Number(raw)
        if (Number.isFinite(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed
        }
      }
    } catch {
      // Ignore localStorage errors (private browsing, etc.)
    }
    return defaultWidth
  })

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const raw = window.localStorage.getItem(storageKeyCollapsed)
      return raw === 'true'
    } catch {
      return false
    }
  })

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Persist width changes
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKeyWidth, String(width))
    } catch {
      // Ignore
    }
  }, [storageKeyWidth, width])

  // Persist collapsed state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKeyCollapsed, String(isCollapsed))
    } catch {
      // Ignore
    }
  }, [storageKeyCollapsed, isCollapsed])

  // Global cursor and user-select styling during drag
  useEffect(() => {
    if (!isDragging) return
    const prevCursor = document.body.style.cursor
    const prevUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onWindowPointerUp = () => {
      dragStartRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerUp)

    return () => {
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevUserSelect
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onWindowPointerUp)
    }
  }, [isDragging])

  // Clamp width when window or container resizes
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef?.current) return
      const containerWidth = containerRef.current.clientWidth
      const maxAllowed = Math.min(maxWidth, Math.max(minWidth, containerWidth - 420))
      setWidth((prev) => (prev > maxAllowed ? maxAllowed : prev))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [containerRef, minWidth, maxWidth])

  // Keyboard shortcut Ctrl+[ / Cmd+[ / Alt+O
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.altKey && event.key.toLowerCase() === 'o') ||
        ((event.ctrlKey || event.metaKey) && event.key === '[')
      ) {
        const target = event.target as HTMLElement | null
        if (
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        ) {
          return
        }
        event.preventDefault()
        setIsCollapsed((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      dragStartRef.current = {
        startX: event.clientX,
        startWidth: width,
      }
      setIsDragging(true)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore if pointer capture unsupported
      }
    },
    [width],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return
      const { startX, startWidth } = dragStartRef.current
      const deltaX = event.clientX - startX
      const containerWidth = containerRef?.current?.clientWidth ?? 1200
      const maxAllowed = Math.min(maxWidth, Math.max(minWidth, containerWidth - 420))
      const rawWidth = startWidth + deltaX
      const clamped = Math.max(minWidth, Math.min(maxAllowed, rawWidth))
      setWidth(clamped)
    },
    [containerRef, minWidth, maxWidth],
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    dragStartRef.current = null
    setIsDragging(false)
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Ignore
    }
  }, [])

  const handleResetWidth = useCallback(() => {
    setWidth(defaultWidth)
  }, [defaultWidth])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setIsCollapsed((prev) => !prev)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        const step = event.shiftKey ? 40 : 16
        setWidth((prev) => Math.max(minWidth, prev - step))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        const step = event.shiftKey ? 40 : 16
        const containerWidth = containerRef?.current?.clientWidth ?? 1200
        const maxAllowed = Math.min(maxWidth, Math.max(minWidth, containerWidth - 420))
        setWidth((prev) => Math.min(maxAllowed, prev + step))
      } else if (event.key === 'Home') {
        event.preventDefault()
        setWidth(minWidth)
      } else if (event.key === 'End') {
        event.preventDefault()
        const containerWidth = containerRef?.current?.clientWidth ?? 1200
        const maxAllowed = Math.min(maxWidth, Math.max(minWidth, containerWidth - 420))
        setWidth(maxAllowed)
      }
    },
    [containerRef, minWidth, maxWidth],
  )

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  return {
    width,
    setWidth,
    isCollapsed,
    setIsCollapsed,
    toggleCollapsed,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleResetWidth,
    handleKeyDown,
    minWidth,
    maxWidth,
    defaultWidth,
  }
}

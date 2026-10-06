import { useCallback, useMemo, useRef, useState } from 'react'
import { GripVertical, PanelLeftOpen } from 'lucide-react'
import { toast } from 'sonner'

import { TopBar } from '@/components/app-top-bar'
import { PlannerCalendar } from '@/components/calendar/planner-calendar'
import { EmptyMonthState } from '@/components/empty-month-state'
import { downloadBlob } from '@/lib/file-download'
import { HolidayImportDialog } from '@/components/holiday-import-dialog'
import { OfficersPanel } from '@/components/officers-panel'
import { SettingsDialog } from '@/components/settings-dialog'
import { ActivitiesTab } from '@/components/tabs/activities-tab'
import { AssignmentsTab } from '@/components/tabs/assignments-tab'
import { HolidaysTab } from '@/components/tabs/holidays-tab'
import { PreviewTab } from '@/components/tabs/preview-tab'
import { WindowControls } from '@/components/window-controls'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { monthLabel, shiftMonthKey } from '@/lib/date'
import type { ParsedHolidayRow } from '@/lib/holidays'
import { collectExportBlockers, collectScheduleWarnings } from '@/lib/schedule-ops'
import { rememberBranchName, type WindowKey } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/state/planner-context'

export function PlannerWorkspace() {
  const planner = usePlanner()
  const {
    state,
    monthKey,
    schedule,
    context,
    settings,
    documentModel,
    isMonthInitialised,
    run,
    setMonthKey,
  } = planner

  const panelResizeContainerRef = useRef<HTMLDivElement>(null)
  const {
    width: leftPanelWidth,
    isCollapsed: isLeftPanelCollapsed,
    isDragging: isLeftPanelDragging,
    setIsCollapsed: setIsLeftPanelCollapsed,
    toggleCollapsed: toggleLeftPanelCollapsed,
    handlePointerDown: handleResizePointerDown,
    handlePointerMove: handleResizePointerMove,
    handlePointerUp: handleResizePointerUp,
    handleResetWidth: handleResetPanelWidth,
    handleKeyDown: handleResizeKeyDown,
    minWidth: minPanelWidth,
    maxWidth: maxPanelWidth,
  } = usePanelResize({ containerRef: panelResizeContainerRef })

  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importSeed, setImportSeed] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  const previousMonthKey = shiftMonthKey(monthKey, -1)
  const previousSchedule = state.months[previousMonthKey]

  const warnings = useMemo(
    () => (schedule ? collectScheduleWarnings(schedule, context) : []),
    [schedule, context],
  )

  const exportBlockers = useMemo(
    () => (schedule ? collectExportBlockers(schedule).map((blocker) => blocker.message) : ['Set this month up first.']),
    [schedule],
  )

  const toggleDay = useCallback(
    (iso: string) => {
      run({ type: 'holidays/toggleDay', iso, monthKey }, { undo: true })
    },
    [run, monthKey],
  )

  const setWindow = useCallback(
    (windowKey: WindowKey, range: { start: string; end: string }) => {
      run({ type: 'month/setWindow', monthKey, windowKey, range })
    },
    [run, monthKey],
  )

  // The PDF and Word engines are large, so they load only when someone exports.
  const exportPdf = useCallback(() => {
    if (!documentModel) return
    setIsBusy(true)
    void (async () => {
      try {
        const { renderSchedulePdf, pdfFileName } = await import('@/lib/export-pdf')
        downloadBlob(renderSchedulePdf(documentModel), pdfFileName(documentModel))
        toast.success('PDF downloaded.')
      } catch (error) {
        toast.error(`The PDF could not be generated: ${describe(error)}`)
      } finally {
        setIsBusy(false)
      }
    })()
  }, [documentModel])

  const exportDocx = useCallback(() => {
    if (!documentModel) return
    setIsBusy(true)
    void (async () => {
      try {
        const { renderScheduleDocx, docxFileName } = await import('@/lib/export-docx')
        downloadBlob(await renderScheduleDocx(documentModel), docxFileName(documentModel))
        toast.success('Word document downloaded.')
      } catch (error) {
        toast.error(`The Word file could not be generated: ${describe(error)}`)
      } finally {
        setIsBusy(false)
      }
    })()
  }, [documentModel])

  function openImport(seed: string) {
    setImportSeed(seed)
    setImportOpen(true)
  }

  function restoreBackup(file: File) {
    void file.text().then((text) => {
      planner.restoreBackupFromText(text)
    })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TopBar
        monthKey={monthKey}
        saveStatus={planner.saveStatus}
        isSaved={planner.saveStatus === 'saved'}
        isBusy={isBusy}
        theme={theme}
        exportBlockers={exportBlockers}
        isOfficersPanelCollapsed={isLeftPanelCollapsed}
        onToggleOfficersPanel={toggleLeftPanelCollapsed}
        onPreviousMonth={planner.goToPreviousMonth}
        onNextMonth={planner.goToNextMonth}
        onMonthChange={setMonthKey}
        onExportPdf={exportPdf}
        onExportDocx={exportDocx}
        onOpenSettings={() => setSettingsOpen(true)}
        onDownloadBackup={planner.downloadBackup}
        onRestoreBackup={restoreBackup}
        onResetAll={planner.resetEverything}
        onLoadSample={planner.loadSample}
        onLoadDefault={() => run({ type: 'month/loadDefault', monthKey })}
        onToggleTheme={() => {
          const next = theme === 'dark' ? 'light' : 'dark'
          setTheme(next)
          document.documentElement.classList.toggle('dark', next === 'dark')
        }}
      />

      {planner.storageWarning ? (
        <Alert variant="destructive" className="mx-4 mt-3">
          <AlertTitle>Browser storage problem</AlertTitle>
          <AlertDescription>{planner.storageWarning}</AlertDescription>
        </Alert>
      ) : null}

      {planner.migrationWarnings.length > 0 ? (
        <Alert className="mx-4 mt-3">
          <AlertTitle>Stored data needed repairing</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {planner.migrationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <main className="flex flex-1 flex-col gap-4 p-4">
        {!isMonthInitialised || !schedule || !documentModel ? (
          <EmptyMonthState
            monthKey={monthKey}
            previousMonthHasList={previousSchedule !== undefined}
            onLoadDefaultData={() => run({ type: 'month/loadDefault', monthKey })}
            onStartBlank={() => run({ type: 'month/startBlank', monthKey })}
            onStartFromLastMonth={() => run({ type: 'month/carryOver', monthKey })}
            onLoadSample={planner.loadSample}
          />
        ) : (
          <>
            <div
              ref={panelResizeContainerRef}
              style={{
                '--officers-width': `${leftPanelWidth}px`,
              } as React.CSSProperties}
              className="relative flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0"
            >
              {/* Officers Panel Column */}
              <div
                className={cn(
                  'shrink-0 lg:h-[calc(100dvh-8.5rem)] lg:min-h-[32rem]',
                  isLeftPanelCollapsed ? 'hidden' : 'w-full officers-panel-col',
                  isLeftPanelDragging ? 'select-none transition-none' : 'transition-[width] duration-150 ease-out',
                )}
                aria-hidden={isLeftPanelCollapsed}
              >
                <OfficersPanel
                  className="h-full w-full"
                  officers={schedule.officers}
                  rosterNames={settings.defaultPermanentRoster}
                  recentNames={settings.recentTemporaryNames}
                  selectedOfficerId={selectedOfficerId}
                  defaultMode="permanent"
                  onSelect={(officerId) =>
                    setSelectedOfficerId((current) => (current === officerId ? null : officerId))
                  }
                  onAddPermanent={(name: string) => run({ type: 'month/addPermanent', monthKey, name })}
                  onAddTemporary={(name) => run({ type: 'month/addTemporary', monthKey, name })}
                  onDismissRecent={(name) => run({ type: 'settings/dismissRecentName', name })}
                  onToggleCrossOut={(officerId) => run({ type: 'month/toggleCrossOut', monthKey, officerId }, { undo: true })}
                  onRename={(officerId, name) => run({ type: 'month/renameOfficer', monthKey, officerId, name })}
                  onRemove={(officerId) =>
                    run({ type: 'month/removeOfficer', monthKey, officerId }, { undo: true, undoLabel: 'Undo remove' })
                  }
                  onReorder={(activeId, overId) => run({ type: 'month/reorderOfficers', monthKey, activeId, overId })}
                  onSetRoster={() => run({ type: 'month/setRoster', monthKey })}
                  onCollapse={() => setIsLeftPanelCollapsed(true)}
                />
              </div>

              {/* Draggable Divider (visible on desktop when uncollapsed) */}
              {!isLeftPanelCollapsed ? (
                <div
                  role="separator"
                  tabIndex={0}
                  aria-orientation="vertical"
                  aria-label="Resize officers panel"
                  aria-valuenow={leftPanelWidth}
                  aria-valuemin={minPanelWidth}
                  aria-valuemax={maxPanelWidth}
                  onPointerDown={handleResizePointerDown}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  onPointerCancel={handleResizePointerUp}
                  onLostPointerCapture={handleResizePointerUp}
                  onKeyDown={handleResizeKeyDown}
                  onDoubleClick={handleResetPanelWidth}
                  className={cn(
                    'group relative hidden lg:flex w-4 shrink-0 cursor-col-resize select-none items-center justify-center touch-none outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm',
                    isLeftPanelDragging && 'select-none',
                  )}
                  title="Drag to resize · Double-click to reset (304px)"
                >
                  <div
                    className={cn(
                      'h-full w-px bg-border transition-colors',
                      'group-hover:bg-primary/50 group-hover:w-[2px]',
                      isLeftPanelDragging && 'bg-primary w-[2px]',
                    )}
                  />
                  <div
                    className={cn(
                      'absolute flex h-8 w-3 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-2xs transition-all',
                      'group-hover:border-primary/50 group-hover:text-foreground group-hover:scale-105',
                      isLeftPanelDragging && 'border-primary bg-primary/10 text-primary scale-110',
                    )}
                  >
                    <GripVertical className="size-3" />
                  </div>
                </div>
              ) : null}

              {/* Main Right Column: Calendar & Controls */}
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {isLeftPanelCollapsed ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsLeftPanelCollapsed(false)}
                      className="h-8 gap-2 border-dashed shadow-xs hover:border-solid hover:bg-accent text-xs font-medium"
                    >
                      <PanelLeftOpen className="size-4 text-primary" />
                      <span>Show Officers Panel</span>
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                        {schedule.officers.length}
                      </Badge>
                    </Button>
                  </div>
                ) : null}

                <WindowControls
                  windows={schedule.windows}
                  context={context}
                  onSetWindow={setWindow}
                  onResetWindows={() => run({ type: 'month/resetWindows', monthKey })}
                />
                <PlannerCalendar
                  monthKey={monthKey}
                  context={context}
                  windows={schedule.windows}
                  schedule={schedule}
                  selectedOfficerId={selectedOfficerId}
                  onToggleDay={toggleDay}
                  onMoveWindowEdge={(windowKey, edge, iso) =>
                    run({ type: 'month/moveWindowEdge', monthKey, windowKey, edge, date: iso })
                  }
                  onShiftWindow={(windowKey, delta) => run({ type: 'month/shiftWindow', monthKey, windowKey, deltaWorkingDays: delta })}
                  className="min-h-[34rem]"
                />
              </div>
            </div>

            <Tabs defaultValue="assignments" className="w-full">
              <TabsList>
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
                <TabsTrigger value="activities">Activities</TabsTrigger>
                <TabsTrigger value="holidays">Holidays</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="assignments" className="mt-3 h-[42rem] min-h-[42rem] w-full">
                <AssignmentsTab
                  schedule={schedule}
                  settings={settings}
                  context={context}
                  warnings={warnings}
                  selectedOfficerId={selectedOfficerId}
                  onSelectOfficer={(officerId) =>
                    setSelectedOfficerId((current) => (current === officerId ? null : officerId))
                  }
                  onSetBranch={(officerId, windowKey, branch) =>
                    run({ type: 'month/setBranch', monthKey, officerId, windowKey, branch })
                  }
                  onSetCustomRanges={(officerId, windowKey, ranges) =>
                    run({ type: 'month/setCustomRanges', monthKey, officerId, windowKey, ranges })
                  }
                  onSwapBranches={(windowKey, fromId, toId) =>
                    run({ type: 'month/swapBranches', monthKey, windowKey, fromId, toId })
                  }
                  onRememberBranch={(branch) =>
                    planner.updateSettings({ recentBranchNames: rememberBranchName(settings, branch).recentBranchNames })
                  }
                />
              </TabsContent>

              <TabsContent value="activities" className="mt-3 h-[42rem] min-h-[42rem] w-full">
                <ActivitiesTab
                  activities={schedule.activities}
                  previousMonthLabel={monthLabel(previousMonthKey)}
                  previousMonthHasList={(previousSchedule?.activities.length ?? 0) > 0}
                  onAdd={(text) => run({ type: 'month/activity/add', monthKey, text })}
                  onUpdate={(index, text) => run({ type: 'month/activity/update', monthKey, index, text })}
                  onRemove={(index) => run({ type: 'month/activity/remove', monthKey, index }, { undo: true, undoLabel: 'Undo delete' })}
                  onMove={(from, to) => run({ type: 'month/activity/move', monthKey, from, to })}
                  onCopyPrevious={() => run({ type: 'month/activity/copyPrevious', monthKey, fromMonthKey: previousMonthKey })}
                />
              </TabsContent>

              <TabsContent value="holidays" className="mt-3 h-[42rem] min-h-[42rem] w-full">
                <HolidaysTab
                  monthKey={monthKey}
                  holidays={state.holidays}
                  weeklyOffDays={settings.weeklyOffDays}
                  onImport={(text) => openImport(text)}
                  onRemove={(iso) => run({ type: 'holidays/remove', iso }, { undo: true })}
                  onClearImportedInMonth={() =>
                    run({ type: 'holidays/clearImportedInMonth', monthKey }, { undo: true, undoLabel: 'Undo clear' })
                  }
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-3 h-[42rem] min-h-[42rem] w-full">
                <PreviewTab
                  model={documentModel}
                  isBusy={isBusy}
                  onExportPdf={exportPdf}
                  onExportDocx={exportDocx}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={(patch) => planner.updateSettings(patch)}
      />

      <HolidayImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        initialText={importSeed}
        onApply={(rows: ParsedHolidayRow[]) => run({ type: 'holidays/import', rows })}
      />
    </div>
  )
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'an unknown error occurred'
}

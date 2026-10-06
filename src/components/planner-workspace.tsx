import { useCallback, useMemo, useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { monthLabel, shiftMonthKey } from '@/lib/date'
import type { ParsedHolidayRow } from '@/lib/holidays'
import { collectExportBlockers, collectScheduleWarnings } from '@/lib/schedule-ops'
import { rememberBranchName, type WindowKey } from '@/lib/schema'
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
            <div className="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
              <div className="xl:h-[calc(100dvh-8.5rem)] xl:min-h-[32rem]">
                <OfficersPanel
                  className="xl:h-full"
                  officers={schedule.officers}
                  rosterNames={settings.defaultPermanentRoster}
                  recentNames={settings.recentTemporaryNames}
                  selectedOfficerId={selectedOfficerId}
                  onSelect={(officerId) =>
                    setSelectedOfficerId((current) => (current === officerId ? null : officerId))
                  }
                  onAddPermanent={(name) => run({ type: 'month/addPermanent', monthKey, name })}
                  onAddTemporary={(name) => run({ type: 'month/addTemporary', monthKey, name })}
                  onDismissRecent={(name) => run({ type: 'settings/dismissRecentName', name })}
                  onToggleCrossOut={(officerId) => run({ type: 'month/toggleCrossOut', monthKey, officerId }, { undo: true })}
                  onRename={(officerId, name) => run({ type: 'month/renameOfficer', monthKey, officerId, name })}
                  onRemove={(officerId) =>
                    run({ type: 'month/removeOfficer', monthKey, officerId }, { undo: true, undoLabel: 'Undo remove' })
                  }
                  onReorder={(activeId, overId) => run({ type: 'month/reorderOfficers', monthKey, activeId, overId })}
                  onSetRoster={() => run({ type: 'month/setRoster', monthKey })}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-4">
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

              <TabsContent value="assignments" className="mt-3">
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

              <TabsContent value="activities" className="mt-3">
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

              <TabsContent value="holidays" className="mt-3">
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

              <TabsContent value="preview" className="mt-3">
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

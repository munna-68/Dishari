import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  FileText,
  Loader2,
  MonitorCog,
  Moon,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
  Upload,
  User,
} from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { MONTH_NAMES, monthLabel, parseMonthKey } from '@/lib/date'
import { cn } from '@/lib/utils'

export interface TopBarProps {
  monthKey: string
  saveStatus: 'idle' | 'pending' | 'saving' | 'saved'
  isSaved: boolean
  isBusy: boolean
  theme: 'light' | 'dark'
  exportBlockers: string[]
  onPreviousMonth: () => void
  onNextMonth: () => void
  onMonthChange: (monthKey: string) => void
  onExportPdf: () => void
  onExportDocx: () => void
  onOpenSettings: () => void
  onDownloadBackup: () => void
  onRestoreBackup: (file: File) => void
  onResetAll: () => void
  onLoadSample: () => void
  onLoadDefault?: () => void
  onToggleTheme: () => void
}

export function TopBar({
  monthKey,
  saveStatus,
  isSaved,
  isBusy,
  theme,
  exportBlockers,
  onPreviousMonth,
  onNextMonth,
  onMonthChange,
  onExportPdf,
  onExportDocx,
  onOpenSettings,
  onDownloadBackup,
  onRestoreBackup,
  onResetAll,
  onLoadSample,
  onLoadDefault,
  onToggleTheme,
}: TopBarProps) {
  const parts = parseMonthKey(monthKey)
  if (!parts) return null
  const currentYear = parts.year
  const currentMonth = parts.month
  const years = buildYearRange(currentYear)

  return (
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur dark:bg-card/80 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2.5 mr-1">
          <div className="flex size-7.5 sm:size-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
            <Calendar className="size-4" />
          </div>
          <h1 className="text-sm font-bold text-foreground tracking-tight hidden md:block">
            Monitoring Schedule Planner
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onPreviousMonth} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <MonthPicker
            month={currentMonth}
            year={currentYear}
            years={years}
            onChange={(next) => onMonthChange(next)}
          />
          <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onNextMonth} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <SaveIndicator status={saveStatus} isSaved={isSaved} />

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg text-xs font-medium border-slate-200" asChild>
            <a
              href="https://github.com/munna-68"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Mahmud Munna on GitHub"
            >
              <User className="size-3.5 text-muted-foreground" />
              <span>Mahmud Munna</span>
            </a>
          </Button>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isBusy} className="h-8 gap-1.5 rounded-lg text-xs font-medium border-slate-200">
                <Download className="size-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Download this month</DropdownMenuLabel>
              {exportBlockers.length > 0 ? (
                <p className="px-2 pb-2 text-xs text-muted-foreground">
                  {exportBlockers.join(' ')} You can still export, but the file will look incomplete.
                </p>
              ) : null}
              <DropdownMenuItem onSelect={onExportPdf}>
                <FileText />
                PDF (landscape A4)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportDocx}>
                <FileDown />
                Word document (.docx)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <p className="px-2 text-xs text-muted-foreground">
                File name: Monitoring_Schedule_{MONTH_NAMES[currentMonth - 1]}_{currentYear}
              </p>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="size-8 rounded-lg border-slate-200" aria-label="Settings and backup">
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Planner</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onOpenSettings}>
                <MonitorCog />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onToggleTheme()}>
                {theme === 'dark' ? <Sun /> : <Moon />}
                Switch to {theme === 'dark' ? 'light' : 'dark'} theme
              </DropdownMenuItem>
              {onLoadDefault ? (
                <DropdownMenuItem onSelect={onLoadDefault}>
                  <Sparkles />
                  Load default data ({monthLabel(monthKey)})
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onLoadSample}>
                <CalendarCheck />
                Load sample: October 2026
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Data</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onDownloadBackup}>
                <Download />
                Download backup
              </DropdownMenuItem>
              <RestoreItem onRestore={onRestoreBackup} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(event) => event.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <RotateCcw />
                    Reset all data
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes every month, the holiday list and the recent names stored in this browser.
                      Download a backup first if you might need it. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onResetAll}>Reset everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function MonthPicker({
  month,
  year,
  years,
  onChange,
}: {
  month: number
  year: number
  years: number[]
  onChange: (monthKey: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor="month-select" className="sr-only">
        Month
      </Label>
      <Select value={String(month)} onValueChange={(value) => onChange(`${year}-${value.padStart(2, '0')}`)}>
        <SelectTrigger id="month-select" className="h-8 w-[8.5rem] rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-800">
          <SelectValue>{MONTH_NAMES[month - 1]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, index) => (
            <SelectItem key={name} value={String(index + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Label htmlFor="year-select" className="sr-only">
        Year
      </Label>
      <Select value={String(year)} onValueChange={(value) => onChange(`${value}-${String(month).padStart(2, '0')}`)}>
        <SelectTrigger id="year-select" className="h-8 w-20 rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-800">
          <SelectValue>{year}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {years.map((value) => (
            <SelectItem key={value} value={String(value)}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SaveIndicator({ status, isSaved }: { status: TopBarProps['saveStatus']; isSaved: boolean }) {
  const label = isSaved ? 'All changes saved' : 'Saving…'
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium',
        isSaved ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
      )}
    >
      {status === 'saving' || !isSaved ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
      )}
      <span className={cn(isSaved && 'text-muted-foreground')}>{label}</span>
    </span>
  )
}

function RestoreItem({ onRestore }: { onRestore: (file: File) => void }) {
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault()
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json,.json'
        input.onchange = () => {
          const file = input.files?.[0]
          if (file) onRestore(file)
        }
        input.click()
      }}
    >
      <Upload />
      Restore backup
    </DropdownMenuItem>
  )
}

function buildYearRange(current: number): number[] {
  const years: number[] = []
  for (let offset = -3; offset <= 5; offset += 1) years.push(current + offset)
  return years
}

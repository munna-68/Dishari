import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { PlannerWorkspace } from '@/components/planner-workspace'
import { PlannerProvider } from '@/state/planner-context'

export default function App() {
  return (
    <PlannerProvider>
      <TooltipProvider delayDuration={200}>
        <PlannerWorkspace />
        <Toaster position="bottom-center" richColors closeButton />
      </TooltipProvider>
    </PlannerProvider>
  )
}

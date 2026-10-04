import { AlertTriangle, FileDown, FileText } from 'lucide-react'

import { PaperPreview } from '@/components/preview/paper-preview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DocumentModel } from '@/lib/document-model'

export interface PreviewTabProps {
  model: DocumentModel
  isBusy: boolean
  onExportPdf: () => void
  onExportDocx: () => void
}

export function PreviewTab({ model, isBusy, onExportPdf, onExportDocx }: PreviewTabProps) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 px-4 py-3">
          <CardTitle className="text-base">Preview</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={onExportPdf} disabled={isBusy}>
              <FileText />
              Download PDF
            </Button>
            <Button size="sm" onClick={onExportDocx} disabled={isBusy}>
              <FileDown />
              Download Word
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            This is the same document the two downloads use, rendered as a landscape A4 sheet.
          </p>
          {model.exportWarnings.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-dashed p-2 text-xs">
              {model.exportWarnings.map((warning) => (
                <li key={warning} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <PaperPreview model={model} />
    </div>
  )
}

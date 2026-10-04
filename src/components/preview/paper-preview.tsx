import { columnWidthsPercent, layoutRows, type DocumentModel } from '@/lib/document-model'

/**
 * Renders the shared document model as a paper-like landscape sheet. The same
 * model feeds the PDF and Word generators, so this preview is a true preview.
 */
export function PaperPreview({ model, className }: { model: DocumentModel; className?: string }) {
  const widths = columnWidthsPercent(model.columns)
  const header = model.rows[0]
  const body = layoutRows(model.rows.slice(1))

  return (
    <div className={className}>
      <article className="paper-sheet mx-auto w-full max-w-[1180px] rounded-sm border p-6 shadow-sm sm:p-8">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{model.title}</h1>
          <p className="text-base font-semibold sm:text-lg">{model.subtitle}</p>
          <h2 className="text-lg font-bold sm:text-xl">{model.heading}</h2>
        </header>
        <p className="mt-2 text-sm">{model.programLine}</p>

        <table className="mt-3 w-full border-collapse text-xs">
          <colgroup>
            {widths.map((width, index) => (
              <col key={model.columns[index]?.key ?? index} style={{ width: `${width}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {(header?.cells ?? []).map((cell, index) => (
                <th
                  key={index}
                  scope="col"
                  className="paper-head-cell paper-rule border px-2 py-2 text-center font-bold"
                >
                  {cell.text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rowIndex) => {
              const visible = row.filter((entry) => entry.merge !== 'continue')
              if (row.length === 1 && row[0]?.cell.colSpan === model.columns.length) {
                return (
                  <tr key={rowIndex}>
                    <td
                      colSpan={model.columns.length}
                      className="paper-rule border px-2 py-4 text-left text-sm"
                    >
                      {row[0]?.cell.text}
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={rowIndex}>
                  {visible.map((entry, index) => {
                    const cell = entry.cell
                    if (cell.hangingIndent) {
                      return (
                        <td
                          key={index}
                          rowSpan={cell.rowSpan}
                          className="paper-rule border px-2 py-2 align-top"
                        >
                          {/* A true hanging indent: the number sits in the margin. */}
                          <ol className="list-none space-y-1">
                            {cell.text.split('\n').map((line, lineIndex) => {
                              const match = /^(\d+\.)\s*(.*)$/.exec(line.trim())
                              return (
                                <li
                                  key={lineIndex}
                                  style={{ paddingLeft: '1.4em', textIndent: '-1.4em' }}
                                >
                                  {match ? (
                                    <>
                                      <span className="inline-block w-[1.4em] tabular-nums">{match[1]}</span>
                                      {match[2]}
                                    </>
                                  ) : (
                                    line
                                  )}
                                </li>
                              )
                            })}
                          </ol>
                        </td>
                      )
                    }
                    return (
                      <td
                        key={index}
                        rowSpan={cell.rowSpan}
                        className="paper-rule border px-2 py-2 align-middle"
                      >
                        {cell.text}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>

        <footer className="mt-6 text-right text-xs">Page | 1</footer>
      </article>
    </div>
  )
}

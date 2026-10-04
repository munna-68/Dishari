/** Triggers a browser download for a generated file and cleans up the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoke a tick later so every browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
}

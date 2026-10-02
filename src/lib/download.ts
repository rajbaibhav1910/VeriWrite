/**
 * Client-side file download. Used for exporting analysis data and reports, where
 * the bytes are already in the browser and there is nothing to fetch from a server.
 */
export function downloadBlob(filename: string, data: BlobPart, mimeType: string): boolean {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return false;

  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // The browser needs the URL only until the navigation is queued.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export function downloadTextFile(filename: string, text: string, mimeType: string): boolean {
  return downloadBlob(filename, text, `${mimeType};charset=utf-8`);
}

/** Filesystem-safe name: nothing that a desktop would refuse, and bounded in length. */
export function safeFileName(input: string, fallback = "veriwrite"): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || fallback;
}

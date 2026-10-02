import { SAMPLE_DOCUMENTS } from "@/data/sampleDocuments";
import { backendConfigured } from "@/lib/api";
import { uid } from "@/lib/utils";
import { createDocument, isPersisting, saveHistoryEntry, listDocuments, updateDocument } from "@/services/documentService";
import { detectText } from "@/services/detectorService";
import type { HistoryEntry } from "@/types";

export interface SeedReport {
  skipped: boolean;
  reason: string;
  documentsCreated: number;
  analysesCreated: number;
}

/**
 * Loads the bundled sample documents into the workspace and, when the detector is
 * running locally, analyses each one for real so History and Reports open onto
 * genuine numbers. Nothing here is invented: with a backend attached the seeding
 * stops at documents rather than writing fake analysis rows.
 */
export async function seedDemoData(
  options: { force?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<SeedReport> {
  if (!isPersisting()) {
    return {
      skipped: true,
      reason: "Local saving is turned off in Preferences, so there is nowhere to seed data into.",
      documentsCreated: 0,
      analysesCreated: 0,
    };
  }

  const existing = listDocuments();
  if (existing.length > 0 && !options.force) {
    return {
      skipped: true,
      reason: `The workspace already holds ${existing.length} ${existing.length === 1 ? "document" : "documents"}.`,
      documentsCreated: 0,
      analysesCreated: 0,
    };
  }

  let documentsCreated = 0;
  let analysesCreated = 0;
  const total = SAMPLE_DOCUMENTS.length;

  for (const [index, sample] of SAMPLE_DOCUMENTS.entries()) {
    const document = createDocument({
      title: sample.title,
      text: sample.text,
      tool: "detector",
      folderId: null,
    });
    documentsCreated += 1;
    options.onProgress?.(index + 1, total);

    if (backendConfigured()) continue;

    const result = await detectText(sample.text);
    const entry: HistoryEntry = {
      id: uid("hist"),
      documentId: document.id,
      title: sample.title,
      tool: "detector",
      analyzedAt: result.analyzedAt,
      wordCount: result.metrics.words,
      aiProbability: result.aiProbability,
      classification: result.classification,
      confidence: result.confidence,
      status: "completed",
      result,
    };
    saveHistoryEntry(entry);
    updateDocument(document.id, { status: "completed" });
    analysesCreated += 1;
  }

  return {
    skipped: false,
    reason: backendConfigured()
      ? "Sample documents loaded. Detection history is left to the connected service."
      : "Sample documents loaded and analysed with the bundled engine.",
    documentsCreated,
    analysesCreated,
  };
}

/** True when the workspace has nothing in it, used to offer the seed action once. */
export function needsDemoSeed(): boolean {
  return listDocuments().length === 0;
}

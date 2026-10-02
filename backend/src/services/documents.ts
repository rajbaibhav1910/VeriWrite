/**
 * Documents: the rows the Documents page lists and the editor autosaves into.
 *
 * Every read here answers the question the UI actually asked — which folder, which tool,
 * favourite or not, matching what text — and every write re-derives what the client did
 * not send: the word count, the timestamp, the title from the text when the name is blank.
 */
import type { DocumentRow } from "../models/index.ts";
import { store } from "../store/memory.ts";
import {
  BadRequest,
  type DocumentWire,
  documentToWire,
  type NewDocumentInput,
  NotFound,
  parseDocumentPatch,
} from "../schemas/wire.ts";
import { dayKey, currentPeriod } from "./usage.ts";

export interface DocumentFilter {
  /** `null` is the unfiled list; `undefined` is every folder. */
  folderId?: string | null;
  tool?: string;
  favorite?: boolean;
  query?: string;
}

export function mustGetDocument(userId: string, documentId: string): DocumentRow {
  const row = store.getDocument(userId, documentId);
  if (!row) throw new NotFound(`No saved document with id "${documentId}" is in this library.`);
  return row;
}

/** A folder a document is filed under has to be one the same user owns. */
export function assertFolder(userId: string, folderId: string | null): void {
  if (folderId === null) return;
  if (!store.getFolder(userId, folderId)) {
    throw new BadRequest(`folderId "${folderId}" does not name a folder in this library.`);
  }
}

export function listDocuments(userId: string, filter: DocumentFilter = {}): DocumentWire[] {
  const needle = filter.query?.trim().toLowerCase() ?? "";
  return store
    .listDocuments(userId)
    .filter((row) => (filter.tool === undefined ? true : row.tool === filter.tool))
    .filter((row) => (filter.folderId === undefined ? true : row.folder_id === filter.folderId))
    .filter((row) => (filter.favorite === true ? row.favorite : true))
    .filter((row) =>
      needle ? `${row.title} ${row.body}`.toLowerCase().includes(needle) : true,
    )
    .map(documentToWire);
}

export function createDocument(userId: string, input: NewDocumentInput): DocumentWire {
  assertFolder(userId, input.folderId);
  const row = store.addDocument({
    user_id: userId,
    title: input.title,
    body: input.text,
    tool: input.tool,
    language: input.language,
    status: input.status,
    folder_id: input.folderId,
  });
  store.recordUsage(userId, currentPeriod(), dayKey(), { documents: 1 });
  return documentToWire(row);
}

/** The PATCH body, applied field by field. An unknown key changes nothing. */
export function patchDocument(userId: string, documentId: string, raw: unknown): DocumentWire {
  const patch = parseDocumentPatch(raw);
  if (patch.folderId !== undefined) assertFolder(userId, patch.folderId);
  const existing = mustGetDocument(userId, documentId);
  const row = store.patchDocument(userId, existing.id, {
    title: patch.title,
    // The client calls this field `text` on the wire; the column is `body`.
    body: patch.text,
    language: patch.language,
    status: patch.status,
    folderId: patch.folderId,
    favorite: patch.favorite,
  });
  if (!row) throw new NotFound(`No saved document with id "${documentId}" is in this library.`);
  return documentToWire(row);
}

/** A copy lands in the same folder as the original and is not a favourite. */
export function duplicateDocument(userId: string, documentId: string): DocumentWire {
  const source = mustGetDocument(userId, documentId);
  const copy = store.addDocument({
    user_id: userId,
    title: `${source.title} (copy)`,
    body: source.body,
    tool: source.tool,
    language: source.language,
    status: source.status,
    folder_id: source.folder_id,
  });
  store.recordUsage(userId, currentPeriod(), dayKey(), { documents: 1 });
  return documentToWire(copy);
}

export function deleteDocument(userId: string, documentId: string): void {
  if (!store.deleteDocument(userId, documentId)) {
    throw new NotFound(`No saved document with id "${documentId}" is in this library.`);
  }
}

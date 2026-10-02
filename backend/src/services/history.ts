/**
 * The History list: filters, sorting and paging over `history`, with each row's
 * measurement joined from `analyses` when it still exists.
 *
 * The rules here are the same rules `searchHistory()` applies in the browser — the needle
 * matches title plus tool, `from`/`to` bound the day inclusive of its last millisecond,
 * and a page beyond the last one is pulled back rather than answered empty. A list that
 * behaved differently on the two paths would be two products.
 */
import type { HistoryRow } from "../models/index.ts";
import { store } from "../store/memory.ts";
import {
  BadRequest,
  type HistoryWire,
  historyToWire,
  type HistoryQuery,
  NotFound,
} from "../schemas/wire.ts";

export interface HistoryPageWire {
  entries: HistoryWire[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Two runs can land in the same second; ids keep the order reproducible. */
const byNewest = (a: HistoryRow, b: HistoryRow) =>
  b.analyzed_at.localeCompare(a.analyzed_at) || b.id.localeCompare(a.id);

const SORTS: Record<string, (a: HistoryRow, b: HistoryRow) => number> = {
  newest: byNewest,
  oldest: (a, b) => -byNewest(a, b),
  "highest-ai": (a, b) => b.ai_probability - a.ai_probability || byNewest(a, b),
  "lowest-ai": (a, b) => a.ai_probability - b.ai_probability || -byNewest(a, b),
  longest: (a, b) => b.word_count - a.word_count || byNewest(a, b),
};

export function searchHistory(userId: string, query: HistoryQuery): HistoryPageWire {
  const needle = query.query?.toLowerCase().trim() ?? "";
  const entries = store
    .listHistory(userId)
    .filter((row) =>
      needle ? `${row.title} ${row.tool}`.toLowerCase().includes(needle) : true,
    )
    .filter((row) => (query.tool ? row.tool === query.tool : true))
    .filter((row) => (query.classification ? row.classification === query.classification : true))
    .filter((row) => (query.confidence ? row.confidence === query.confidence : true))
    .filter((row) => (query.from ? row.analyzed_at >= query.from : true))
    .filter((row) => (query.to ? row.analyzed_at <= `${query.to}T23:59:59.999Z` : true))
    .sort(SORTS[query.sort] ?? SORTS.newest);

  const total = entries.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  return {
    entries: entries
      .slice((page - 1) * query.pageSize, page * query.pageSize)
      .map((row) => historyToWire(row, store.analysisFor(row))),
    total,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export function getHistoryEntry(userId: string, entryId: string): {
  entry: HistoryWire;
  analysis: HistoryRow;
} {
  const row = store.getHistoryEntry(userId, entryId);
  if (!row) throw new NotFound(`No saved analysis with id "${entryId}" is in this library.`);
  return { entry: historyToWire(row, store.analysisFor(row)), analysis: row };
}

/** Renaming a row changes its name and nothing else — never the measurement, never the text. */
export function renameHistoryEntry(userId: string, entryId: string, raw: unknown): HistoryWire {
  const body =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!body) throw new BadRequest("The history patch must be a JSON object.");
  if (typeof body.title !== "string") throw new BadRequest("title must be a string.");
  const title = body.title.trim();
  if (!title) throw new BadRequest("title must not be empty.");
  const row = store.patchHistory(userId, entryId, title);
  if (!row) throw new NotFound(`No saved analysis with id "${entryId}" is in this library.`);
  return historyToWire(row, store.analysisFor(row));
}

export function deleteHistoryEntry(userId: string, entryId: string): void {
  if (!store.deleteHistoryEntry(userId, entryId)) {
    throw new NotFound(`No saved analysis with id "${entryId}" is in this library.`);
  }
}

/** One call clears the list; the row count is what the page can then say it removed. */
export function clearHistory(userId: string): number {
  return store.clearHistory(userId);
}

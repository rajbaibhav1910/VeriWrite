import { useCallback, useEffect, useState } from "react";
import { backendConfigured, toServiceError } from "@/lib/api";
import type { ServiceError } from "@/types";
import {
  listDocuments,
  listFolders,
  listHistory,
  loadHistory,
  loadLibrary,
  searchHistory,
  type HistoryFilter,
  type HistoryPage,
  type LibrarySource,
} from "@/services/documentService";
import type { Folder, StoredDocument } from "@/types";

export interface LibraryState {
  status: "loading" | "ready" | "error";
  source: LibrarySource;
  documents: StoredDocument[];
  folders: Folder[];
  /** Saved analyses, counted wherever the library sits. */
  analyses: number;
  /** Rows the service sent that this build cannot label. */
  unreadable: number;
  error: ServiceError | null;
}

export interface HistoryRowsState {
  status: "loading" | "ready" | "error";
  source: LibrarySource;
  page: HistoryPage | null;
  error: ServiceError | null;
  reload: () => void;
}

/**
 * The library's rows. With no service attached they are read during the first render,
 * because they are already on this device; with one they arrive from the service, and a
 * failed read keeps the last rows and says so rather than pretending the shelf emptied.
 */
export function useLibrary(revision: number): LibraryState {
  const [state, setState] = useState<LibraryState>(() =>
    backendConfigured()
      ? {
          status: "loading",
          source: "api service",
          documents: [],
          folders: [],
          analyses: 0,
          unreadable: 0,
          error: null,
        }
      : localLibraryState(),
  );

  useEffect(() => {
    if (!backendConfigured()) {
      setState(localLibraryState());
      return;
    }
    let active = true;
    setState((current) => ({ ...current, status: "loading", error: null }));
    void (async () => {
      try {
        const next = await loadLibrary();
        if (active) setState({ status: "ready", ...next, error: null });
      } catch (caught) {
        if (active) {
          setState((current) => ({ ...current, status: "error", error: toServiceError(caught) }));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [revision]);

  return state;
}

function localLibraryState(): LibraryState {
  return {
    status: "ready",
    source: "this browser's storage",
    documents: listDocuments(),
    folders: listFolders(),
    analyses: listHistory().length,
    unreadable: 0,
    error: null,
  };
}

/**
 * One page of the history list. The caller builds `filters` with a memo: a new object
 * every render would be read as a changed filter and asked the service again.
 */
export function useHistoryRows(filters: HistoryFilter): HistoryRowsState {
  const [page, setPage] = useState<HistoryPage | null>(() =>
    backendConfigured() ? null : searchHistory(filters),
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    backendConfigured() ? "loading" : "ready",
  );
  const [error, setError] = useState<ServiceError | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!backendConfigured()) {
      setPage(searchHistory(filters));
      setStatus("ready");
      setError(null);
      return;
    }
    let active = true;
    setStatus("loading");
    setError(null);
    void (async () => {
      try {
        const next = await loadHistory(filters);
        if (!active) return;
        setPage(next);
        setStatus("ready");
      } catch (caught) {
        if (active) {
          setError(toServiceError(caught));
          setStatus("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [filters, nonce]);

  return {
    status,
    source: backendConfigured() ? "api service" : "this browser's storage",
    page,
    error,
    reload,
  };
}

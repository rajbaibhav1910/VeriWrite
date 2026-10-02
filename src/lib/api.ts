import type { ServiceError } from "@/types";

/**
 * Single boundary between the frontend and a backend.
 *
 * When VITE_API_BASE_URL is unset the app runs fully client-side: every service
 * checks `backendConfigured()` first and falls back to its local engine. Nothing
 * in the UI is allowed to fake a network round trip.
 */
/** Read lazily so the module also loads under node (tests, tooling) and SSR. */
function apiBaseUrl(): string {
  return (import.meta.env?.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
}

export const backendConfigured = () => apiBaseUrl().length > 0;

/** Absolute URL for a path on the configured backend; used by streaming endpoints. */
export function apiUrl(path: string): string {
  return `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error implements ServiceError {
  code: ServiceError["code"];
  hint?: string;
  status?: number;

  constructor(code: ServiceError["code"], message: string, hint?: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

export function toServiceError(error: unknown): ServiceError {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, hint: error.hint };
  }
  if (error instanceof TypeError) {
    return {
      code: "network",
      message: "We could not reach the service.",
      hint: "Check your connection and try again.",
    };
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "timeout",
      message: "That analysis took too long and was cancelled.",
      hint: "Try a shorter passage.",
    };
  }
  return {
    code: "unknown",
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 45_000;

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, query, timeoutMs = DEFAULT_TIMEOUT, headers, ...rest } = options;

  const url = new URL(`${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ApiError(
        response.status === 401 || response.status === 403
          ? "auth"
          : response.status === 429
            ? "rate_limited"
            : "api",
        response.status === 429
          ? "You have hit the limit for this plan."
          : `Request failed with status ${response.status}.`,
        response.status === 429 ? "Upgrade your plan or wait for the monthly reset." : undefined,
        response.status,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Multipart upload used by the file-processing endpoints. */
export async function uploadFile<T>(path: string, file: File, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return apiRequest<T>(path, { method: "POST", body: form });
}

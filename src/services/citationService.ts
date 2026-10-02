import type { Citation, CitationSourceType, CitationStyle, ServiceError } from "@/types";
import { ApiError, apiRequest, backendConfigured } from "@/lib/api";
import { requireRecord } from "@/lib/service";
import {
  CITATION_EXAMPLES,
  CITATION_FIELD_LABELS,
  CITATION_SOURCE_TYPES,
  CITATION_STYLES,
  buildAllStyles,
  buildCitation,
  citationSortKey,
  fieldsForSourceType,
  inTextNarrative,
  inTextParenthetical,
  missingCoreFields,
  numberReferences,
  parseDoi,
  parseUrl,
  sortBibliography,
} from "@/lib/tools/citationEngine";
import type { CitationField, CitationFields } from "@/lib/tools/citationEngine";

export {
  CITATION_EXAMPLES,
  CITATION_FIELD_LABELS,
  CITATION_SOURCE_TYPES,
  CITATION_STYLES,
  buildAllStyles,
  citationSortKey,
  fieldsForSourceType,
  inTextNarrative,
  inTextParenthetical,
  missingCoreFields,
  parseDoi,
  parseUrl,
  sortBibliography,
};
export type { CitationField, CitationFields };

export const DOI_LOOKUP_UNAVAILABLE: ServiceError = {
  code: "api",
  message:
    "Resolving a DOI needs the reference service, which is not connected in this build.",
  hint: "Enter the fields shown on the source page yourself, or point VITE_API_BASE_URL at a backend that implements GET /api/cite/resolve.",
};

function isStyle(value: unknown): value is CitationStyle {
  return typeof value === "string" && CITATION_STYLES.some((style) => style.id === value);
}

function guardCitation(value: unknown, index: number): Citation {
  const record = requireRecord(value, "citation");
  const formatted = typeof record.formatted === "string" ? record.formatted : "";
  return {
    id: typeof record.id === "string" ? record.id : `cite_remote_${index}`,
    style: isStyle(record.style) ? record.style : "apa",
    sourceType: (CITATION_SOURCE_TYPES.some((type) => type.id === record.sourceType)
      ? record.sourceType
      : "webpage") as CitationSourceType,
    formatted,
    bibliographyEntry:
      typeof record.bibliographyEntry === "string" ? record.bibliographyEntry : formatted,
    inText: typeof record.inText === "string" ? record.inText : "",
    fields:
      record.fields && typeof record.fields === "object"
        ? (record.fields as Record<string, string>)
        : {},
  };
}

/** Builds one reference in one style. Pure and local: no service is contacted. */
export function createCitation(options: {
  style: CitationStyle;
  sourceType: CitationSourceType;
  fields: CitationFields;
  id?: string;
  number?: number;
}): Citation {
  return buildCitation(options);
}

export function createCitationInAllStyles(
  sourceType: CitationSourceType,
  fields: CitationFields,
): Citation[] {
  return buildAllStyles(sourceType, fields);
}

export interface ResolvedSource {
  sourceType: CitationSourceType;
  fields: CitationFields;
  /** True when the values were inferred from the URL or DOI string alone. */
  inferred: boolean;
  note: string;
}

/**
 * Turns a URL into a starting point for a reference. Without a backend this is a
 * local reading of the URL itself — the result is flagged as inferred so the UI
 * cannot present it as verified metadata. Unreadable addresses and backend
 * failures throw, so the value here is always a resolved source.
 */
export async function resolveFromUrl(url: string): Promise<ResolvedSource> {
  const parsed = parseUrl(url);
  if (!parsed.valid) {
    throw new ApiError(
      "invalid_file",
      "That is not a web address this tool can read.",
      "Include the scheme, for example https://example.com/article-title.",
    );
  }

  if (backendConfigured()) {
    const payload = await apiRequest<unknown>(`/api/cite/resolve?url=${encodeURIComponent(url)}`);
    const record = requireRecord(payload, "citation");
    return {
      sourceType: (CITATION_SOURCE_TYPES.some((type) => type.id === record.sourceType)
        ? record.sourceType
        : "webpage") as CitationSourceType,
      fields: (record.fields && typeof record.fields === "object"
        ? record.fields
        : {}) as CitationFields,
      inferred: false,
      note: "Metadata returned by the reference service.",
    };
  }

  return {
    sourceType: "webpage",
    fields: {
      url: parsed.url,
      containerTitle: parsed.suggestedContainer,
      title: parsed.suggestedTitle,
    },
    inferred: true,
    note: "Read from the web address only. Check the title, author and date against the page before citing.",
  };
}

export function isDoi(value: string) {
  return parseDoi(value);
}

/** A DOI is metadata the user supplies; resolving it needs the reference service. */
export function doiFields(doi: string): CitationFields {
  const parsed = parseDoi(doi);
  return parsed.valid ? { doi: parsed.doi, url: parsed.url } : {};
}

export function sortReferenceList(citations: Citation[]): Citation[] {
  return sortBibliography(citations);
}

export function numberedReferenceList(citations: Citation[]): Citation[] {
  return numberReferences(citations);
}

/** Restores a saved list. Rows that are not objects at all are dropped, not fatal. */
export function guardCitationList(payload: unknown): Citation[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter((item) => item !== null && typeof item === "object").map(guardCitation);
}

const FIELD_NAME: Record<string, string> = Object.fromEntries(
  CITATION_FIELD_LABELS.map((field) => [field.id, field.label]),
);

/** One line telling the user what the entry still lacks, in plain words. */
export function describeCitationReadiness(
  sourceType: CitationSourceType,
  fields: CitationFields,
): string {
  const missing = missingCoreFields(sourceType, fields);
  if (missing.length === 0) return "Every field this style needs is filled.";
  const names = missing.map((field) => FIELD_NAME[field] ?? field);
  if (names.length === 1) return `Still missing ${names[0]}. The entry builds without it, but reads as an incomplete reference.`;
  return `Still missing ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}. The entry builds without them, but reads as an incomplete reference.`;
}

/** Author-date styles take a sorted list; IEEE takes the order the works were cited. */
export function bibliographyFor(citations: Citation[], style: CitationStyle): Citation[] {
  return style === "ieee" ? numberedReferenceList(citations) : sortBibliography(citations);
}

/** Plain text for the copy button: one entry per line, numbers where they belong. */
export function bibliographyAsText(citations: Citation[]): string {
  return citations
    .map((citation, index) => {
      const entry = stripItalicMarkers(citation.bibliographyEntry || citation.formatted);
      return citation.style === "ieee" ? `[${index + 1}] ${entry}` : entry;
    })
    .join("\n\n")
    .trim();
}

function stripItalicMarkers(value: string) {
  return value.replace(/\*(.+?)\*/gu, "$1");
}

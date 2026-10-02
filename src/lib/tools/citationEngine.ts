import type { Citation, CitationSourceType, CitationStyle } from "@/types";
import { normalizeText } from "@/lib/text";

/**
 * Citation formatter. Everything here is deterministic string work against the
 * published rules of each style: there is no network lookup, no metadata
 * enrichment and no page scraping. Missing fields degrade the entry the way a
 * manual entry does in a real bibliography tool — the citation stays valid, it
 * just gets shorter, and title-first replaces the author.
 */

export type CitationField =
  | "authors"
  | "authorLast"
  | "authorFirst"
  | "authorMiddle"
  | "corporateAuthor"
  | "year"
  | "month"
  | "day"
  | "title"
  | "secondaryTitle"
  | "containerTitle"
  | "publisher"
  | "place"
  | "volume"
  | "issue"
  | "pageFrom"
  | "pageTo"
  | "edition"
  | "doi"
  | "url"
  | "accessed"
  | "reportNumber";

export type CitationFields = Partial<Record<CitationField, string>>;

export const CITATION_FIELD_LABELS: { id: CitationField; label: string; hint: string }[] = [
  { id: "authors", label: "Authors", hint: "Separate people with “and”, or invert as “Smith, John”." },
  { id: "authorLast", label: "Last name", hint: "Family name of the first author." },
  { id: "authorFirst", label: "First name", hint: "Given name; APA and Harvard show an initial." },
  { id: "authorMiddle", label: "Middle name", hint: "Optional second initial." },
  { id: "corporateAuthor", label: "Organisation", hint: "Use when a body, not a person, wrote it." },
  { id: "year", label: "Year", hint: "Four digits, for example 2024." },
  { id: "month", label: "Month", hint: "News and web pages use the full date." },
  { id: "day", label: "Day", hint: "Day of the month." },
  { id: "title", label: "Title", hint: "Title of the item itself." },
  { id: "secondaryTitle", label: "Subtitle", hint: "Text after the colon, if there is one." },
  { id: "containerTitle", label: "Journal or site", hint: "The larger work that contains it." },
  { id: "publisher", label: "Publisher", hint: "For books; the site name for web pages." },
  { id: "place", label: "Place of publication", hint: "City, used by Chicago and some Harvard schools." },
  { id: "volume", label: "Volume", hint: "Journal volume number." },
  { id: "issue", label: "Issue", hint: "Journal issue number." },
  { id: "pageFrom", label: "First page", hint: "Page range starts here." },
  { id: "pageTo", label: "Last page", hint: "Page range ends here." },
  { id: "edition", label: "Edition", hint: "For example 3rd." },
  { id: "doi", label: "DOI", hint: "Digital object identifier, with or without the https prefix." },
  { id: "url", label: "URL", hint: "Direct link to the item." },
  { id: "accessed", label: "Accessed", hint: "Date you read it, YYYY-MM-DD or “12 March 2024”." },
  { id: "reportNumber", label: "Report or series no.", hint: "Number issued by the publishing body." },
];

export const CITATION_STYLES: { id: CitationStyle; label: string; note: string }[] = [
  { id: "apa", label: "APA 7th", note: "Sciences, education, social sciences." },
  { id: "mla", label: "MLA 9th", note: "Humanities and literature." },
  { id: "chicago", label: "Chicago 17th", note: "History; author-date form." },
  { id: "harvard", label: "Harvard", note: "Economics and many UK programmes." },
  { id: "ieee", label: "IEEE", note: "Engineering and computer science." },
];

export const CITATION_SOURCE_TYPES: { id: CitationSourceType; label: string }[] = [
  { id: "webpage", label: "Web page" },
  { id: "book", label: "Book" },
  { id: "journal", label: "Journal article" },
  { id: "news", label: "News article" },
  { id: "manual", label: "Report / manual" },
];

/**
 * Which inputs a source type actually has. A field absent from this list is not
 * offered: a book never asks for a journal volume, and a news article never asks
 * for an edition.
 */
export const CITATION_FORM_FIELDS: Record<CitationSourceType, CitationField[]> = {
  webpage: ["authors", "corporateAuthor", "year", "month", "day", "title", "containerTitle", "publisher", "url", "accessed"],
  book: ["authors", "year", "title", "secondaryTitle", "edition", "place", "publisher", "doi", "url"],
  journal: ["authors", "year", "title", "secondaryTitle", "containerTitle", "volume", "issue", "pageFrom", "pageTo", "doi", "url"],
  news: ["authors", "corporateAuthor", "year", "month", "day", "title", "containerTitle", "url", "accessed"],
  manual: ["corporateAuthor", "authors", "year", "title", "secondaryTitle", "reportNumber", "place", "publisher", "url", "accessed"],
};

/**
 * The pieces a style cannot do without for this source type. Missing ones do not
 * break the entry — the formatter degrades the way a manual entry does — but the
 * reader should know what was left out.
 */
export const CITATION_CORE_FIELDS: Record<CitationSourceType, CitationField[]> = {
  webpage: ["title", "url"],
  book: ["authors", "year", "title", "publisher"],
  journal: ["authors", "year", "title", "containerTitle"],
  news: ["title", "containerTitle", "url"],
  manual: ["title", "corporateAuthor"],
};

export function fieldsForSourceType(sourceType: CitationSourceType): CitationField[] {
  return CITATION_FORM_FIELDS[sourceType] ?? CITATION_FORM_FIELDS.webpage;
}

/** Core fields with nothing in them. `authors` counts as filled by a corporate author. */
export function missingCoreFields(
  sourceType: CitationSourceType,
  fields: CitationFields,
): CitationField[] {
  const filled = (field: CitationField) => Boolean((fields[field] ?? "").trim());
  return (CITATION_CORE_FIELDS[sourceType] ?? []).filter((field) => {
    if (field === "authors") return !(filled("authors") || filled("corporateAuthor"));
    if (field === "corporateAuthor") return !(filled("corporateAuthor") || filled("authors"));
    return !filled(field);
  });
}

export function citationIsWorthShowing(sourceType: CitationSourceType, fields: CitationFields) {
  return Object.values(fields).some((value) => typeof value === "string" && value.trim().length > 0)
    ? true
    : missingCoreFields(sourceType, fields).length === 0;
}

/** Italic spans in plain-text output use `*asterisks*`; the UI renders them. */
export function italics(value: string) {
  return value ? `*${value}*` : "";
}

/* ------------------------------------------------------------------ names -- */

const ORG_HINTS =
  /\b(organization|organisation|agency|institute|university|department|ministry|bureau|commission|committee|society|centre|center|association|council|government|company|corporation|llc|ltd|nasa|oecd|united nations|world health|european commission|bank of|imf|unepco)\b/iu;

const PARTICLES = /^(van|von|de|del|della|di|da|dos|du|la|le|der|den|ten|ter|bin|ibn|el|al)$/iu;

export interface AuthorName {
  last: string;
  first: string;
  /** Surname particles kept with the family name: "van der". */
  particles: string;
}

export function parseAuthor(raw: string): AuthorName | null {
  const clean = raw.replace(/\s+/gu, " ").trim().replace(/[;,]+$/u, "");
  if (!clean) return null;
  if (ORG_HINTS.test(clean)) return { last: clean, first: "", particles: "" };

  if (clean.includes(",")) {
    const [last = "", rest = ""] = clean.split(",");
    return { last: last.trim(), first: rest.trim(), particles: "" };
  }

  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return { last: parts[0] ?? "", first: "", particles: "" };

  // Particles sit in front of the surname: "Ludwig van Beethoven".
  const head = parts.slice(0, -1);
  let split = head.length;
  for (let i = 0; i < head.length; i += 1) {
    if (PARTICLES.test(head[i] ?? "")) {
      split = i;
      break;
    }
  }
  return {
    last: parts[parts.length - 1] ?? "",
    first: head.slice(0, split).join(" "),
    particles: head.slice(split).join(" "),
  };
}

export function parseAuthors(raw: string): AuthorName[] {
  const clean = (raw || "").trim();
  if (!clean) return [];
  // `and` / `&` are the safe separators; splitting on commas would break the
  // inverted "Smith, John" form that many users paste in.
  const chunks = clean
    .replace(/\s+and\s+/giu, ";")
    .replace(/\s*&\s*/gu, ";")
    .replace(/;\s*/gu, ";")
    .replace(/,(?=\s+[A-Z][a-z]+,)/gu, ";")
    .split(";");
  return chunks.map((chunk) => parseAuthor(chunk)).filter((a): a is AuthorName => a !== null && a.last !== "");
}

function initialsOf(author: AuthorName): string {
  return [author.first, author.particles]
    .join(" ")
    .split(/[\s.]+/u)
    .filter(Boolean)
    .map((part) => `${(part[0] ?? "").toUpperCase()}.`)
    .join(" ");
}

function surnameOf(author: AuthorName): string {
  return author.particles ? `${author.particles} ${author.last}` : author.last;
}

function apaAuthors(authors: AuthorName[]): string {
  if (authors.length === 0) return "";
  const rendered = authors.map((a) => {
    const initials = initialsOf(a);
    // A corporate author is a full name, so it ends with a sentence period.
    return initials ? `${a.last}, ${initials}` : withPeriod(a.last);
  });
  if (rendered.length === 1) return `${rendered[0]}`;
  // APA lists every author up to 20; beyond that, first 19, an ellipsis, the last.
  if (rendered.length <= 20) return `${rendered.slice(0, -1).join(", ")}, & ${rendered[rendered.length - 1]}`;
  return `${rendered.slice(0, 19).join(", ")}, … ${rendered[rendered.length - 1]}`;
}

function mlaAuthors(authors: AuthorName[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) {
    const only = authors[0] as AuthorName;
    return only.first ? `${only.last}, ${only.first}.` : `${only.last}.`;
  }
  const lead = authors[0] as AuthorName;
  const leadText = lead.first ? `${lead.last}, ${lead.first}` : lead.last;
  if (authors.length === 2) {
    const second = authors[1] as AuthorName;
    return `${leadText}, and ${[second.first, surnameOf(second)].filter(Boolean).join(" ")}.`;
  }
  return `${leadText}, et al.`;
}

function chicagoAuthors(authors: AuthorName[]): string {
  if (authors.length === 0) return "";
  const natural = (a: AuthorName) => [a.first, surnameOf(a)].filter(Boolean).join(" ");
  const lead = authors[0] as AuthorName;
  const leadText = lead.first ? `${lead.last}, ${lead.first}` : lead.last;
  const rest = authors.slice(1);
  if (rest.length === 0) return `${leadText}.`;
  if (rest.length <= 2) return `${leadText}, and ${rest.map(natural).join(", and ")}.`;
  return `${leadText} et al.`;
}

function withPeriod(value: string) {
  return /[.\s]$/u.test(value) ? `${value.trim()}` : `${value}.`;
}

function harvardAuthors(authors: AuthorName[]): string {
  if (authors.length === 0) return "";
  const one = (a: AuthorName) => {
    const initials = initialsOf(a).replace(/\s/gu, "");
    return initials ? `${surnameOf(a)}, ${initials}` : surnameOf(a);
  };
  if (authors.length === 1) return withPeriod(one(authors[0] as AuthorName));
  if (authors.length <= 3) {
    return `${withPeriod(one(authors[0] as AuthorName))}${authors.slice(1, -1).map((a) => `, ${one(a)}`).join("")} and ${withPeriod(one(authors[authors.length - 1] as AuthorName))}`;
  }
  return `${withPeriod(one(authors[0] as AuthorName))} et al.`;
}

function ieeeAuthors(authors: AuthorName[]): string {
  if (authors.length === 0) return "";
  const one = (a: AuthorName) => {
    const initials = initialsOf(a);
    return initials ? `${initials} ${surnameOf(a)}` : surnameOf(a);
  };
  if (authors.length === 1) return one(authors[0] as AuthorName);
  if (authors.length === 2) return `${one(authors[0] as AuthorName)} and ${one(authors[1] as AuthorName)}`;
  if (authors.length <= 6) {
    return `${authors.slice(0, -1).map(one).join(", ")}, and ${one(authors[authors.length - 1] as AuthorName)}`;
  }
  return `${one(authors[0] as AuthorName)} et al.`;
}

/** "(Smith, 2019)" / "(Smith and Jones, 2019)" / "(Smith et al., 2019)". */
function inTextSurname(authors: AuthorName[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return surnameOf(authors[0] as AuthorName);
  if (authors.length === 2) {
    return `${surnameOf(authors[0] as AuthorName)} and ${surnameOf(authors[1] as AuthorName)}`;
  }
  return `${surnameOf(authors[0] as AuthorName)} et al.`;
}

/* ------------------------------------------------------- field resolution -- */

interface Resolved {
  authors: AuthorName[];
  authorText: string;
  year: string;
  month: string;
  day: string;
  title: string;
  subtitle: string;
  container: string;
  publisher: string;
  place: string;
  volume: string;
  issue: string;
  pages: string;
  edition: string;
  doi: string;
  url: string;
  accessed: string;
  reportNumber: string;
}

function text(fields: CitationFields, key: CitationField): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

function authorTextOf(fields: CitationFields): string {
  const list = text(fields, "authors");
  if (list) return list;
  const corporate = text(fields, "corporateAuthor");
  if (corporate) return corporate;
  const last = text(fields, "authorLast");
  if (!last) return "";
  const first = [text(fields, "authorFirst"), text(fields, "authorMiddle")].filter(Boolean).join(" ");
  return first ? `${last}, ${first}` : last;
}

function pagesOf(fields: CitationFields, dash: string): string {
  const from = text(fields, "pageFrom");
  const to = text(fields, "pageTo");
  if (!from) return "";
  return to ? `${from}${dash}${to}` : from;
}

function editionOf(fields: CitationFields): string {
  const raw = text(fields, "edition").replace(/\b(edition|edn\.?)\b/giu, "").replace(/\s+/gu, " ").trim();
  return raw;
}

function doiOf(doi: string): string {
  const clean = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//iu, "");
  return clean ? `https://doi.org/${clean}` : "";
}

const PLAIN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MLA_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const SHORT_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

function monthName(raw: string, table: string[]): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^\d{1,2}$/u.test(value)) return table[Number(value) - 1] ?? value;
  const hit = table.findIndex((m) => value.toLowerCase().startsWith(m.toLowerCase().slice(0, 3)));
  return hit >= 0 ? table[hit] : value;
}

/** "March 15, 2024" (Chicago/APA), "15 Mar. 2024" (MLA) or "12 March 2024" (Harvard). */
function longDate(resolved: Resolved, order: "month-day" | "day-month", table: string[]): string {
  if (!resolved.year) return "";
  const month = monthName(resolved.month, table);
  if (!month) return resolved.year;
  if (!resolved.day) return `${month} ${resolved.year}`;
  return order === "month-day"
    ? `${month} ${resolved.day}, ${resolved.year}`
    : `${resolved.day} ${month} ${resolved.year}`;
}

function accessedDate(raw: string, style: CitationStyle): string {
  const clean = raw.trim();
  if (!clean) return "";
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(clean);
  if (!iso) return clean;
  const month = Number(iso[2]);
  const day = String(Number(iso[3]));
  switch (style) {
    case "mla":
      return `${day} ${monthName(String(month), MLA_MONTHS)} ${iso[1]}`;
    case "ieee":
      return `${day} ${monthName(String(month), SHORT_MONTHS)} ${iso[1]}`.replace(/\s+/gu, " ");
    case "chicago":
      return `${monthName(String(month), PLAIN_MONTHS)} ${day}, ${iso[1]}`;
    case "apa":
      return `${monthName(String(month), PLAIN_MONTHS)} ${day}, ${iso[1]}`;
    default:
      return `${day} ${monthName(String(month), PLAIN_MONTHS)} ${iso[1]}`;
  }
}

export function formatAccessed(raw: string, style: CitationStyle = "harvard"): string {
  return accessedDate(raw, style);
}

const LOWER_IN_HEADLINE = /^(a|an|and|as|at|but|by|en|for|in|of|on|or|the|to|v|with)$/iu;

export function headlineCase(title: string): string {
  const words = title.split(/\s+/u).filter(Boolean);
  return words
    .map((word, index) => {
      if (index !== 0 && index !== words.length - 1 && LOWER_IN_HEADLINE.test(word)) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** APA/Chicago/Harvard use sentence case for titles; keep existing capitals. */
export function sentenceCase(title: string): string {
  const clean = title.trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function stripTrailingPeriod(value: string) {
  return value.replace(/[.\s]+$/u, "");
}

/** The year on its own, without a doubled period when the date is unknown. */
function yearClause(year: string) {
  return yearClauseOf(year, "");
}

function yearClauseOf(year: string, fallback: string) {
  if (year) return `${year}.`;
  return fallback || "n.d.";
}

/** The publication clause, built only from the pieces that were actually filled. */
function joinClause(items: string[]) {
  return items.filter((item) => item.trim().length > 0).join(", ");
}

/* ------------------------------------------------------------- the styles -- */

/** MLA dates a periodical by day and abbreviated month, or by year alone. */
function mlaDateOf(resolved: Resolved) {
  return resolved.month ? longDate(resolved, "day-month", MLA_MONTHS) : resolved.year;
}

/** IEEE keeps the month first and abbreviates it: "Mar. 14, 2023". */
function ieeeDateOf(resolved: Resolved) {
  return resolved.month ? longDate(resolved, "month-day", SHORT_MONTHS) : resolved.year;
}

function apa(resolved: Resolved, sourceType: CitationSourceType): { formatted: string; inText: string } {
  const title = sentenceCase([resolved.title, resolved.subtitle].filter(Boolean).join(": "));
  const parts: string[] = [];
  const authorBlock = resolved.authorText ? apaAuthors(resolved.authors) : "";
  const container = resolved.container;
  // APA keeps the article title plain and the container italic; books and
  // web pages italicise the item title instead.
  const itemTitle = sourceType === "journal" || sourceType === "news" ? title : italics(title);
  const fallbackTitle = title || sentenceCase(resolved.container);

  if (!authorBlock && fallbackTitle) {
    parts.push(`${sourceType === "journal" || sourceType === "news" ? fallbackTitle : italics(fallbackTitle)}. `);
  }
  if (authorBlock) parts.push(`${authorBlock} `);
  const date =
    sourceType === "webpage" || sourceType === "news"
      ? longDate(resolved, "month-day", PLAIN_MONTHS) || "n.d."
      : resolved.year || "n.d.";
  parts.push(`(${date}). `);
  if (authorBlock && itemTitle) {
    parts.push(`${itemTitle}. `);
  }

  if (sourceType === "book") {
    if (resolved.edition) parts.push(`(${resolved.edition} ed.). `);
    if (resolved.publisher) parts.push(`${resolved.publisher}. `);
  } else if (sourceType === "journal") {
    if (container) parts.push(`${italics(container)}, `);
    if (resolved.volume) parts.push(`${italics(resolved.volume)}`);
    if (resolved.issue) parts.push(`(${resolved.issue})`);
    if (container || resolved.volume) parts.push(", ");
    parts.push(`${resolved.pages}. `);
  } else if (sourceType === "news") {
    if (container && authorBlock) parts.push(`${italics(container)}. `);
  } else if (sourceType === "manual") {
    if (resolved.reportNumber) parts.push(`(Report No. ${resolved.reportNumber}). `);
    if (container && container !== title) parts.push(`${italics(container)}. `);
    if (resolved.publisher) parts.push(`${resolved.publisher}. `);
  } else if (container && container !== title) {
    parts.push(`${italics(container)}. `);
  }

  if (resolved.doi) parts.push(`${resolved.doi}. `);
  else if (resolved.url) parts.push(`${resolved.url}. `);
  else if ((sourceType === "webpage" || sourceType === "news") && resolved.accessed) {
    parts.push(`Retrieved ${accessedDate(resolved.accessed, "apa")}. `);
  }

  const name = inTextSurname(resolved.authors) || sentenceCase(fallbackTitle) || "Untitled";
  const lead = name.length > 44 ? `${name.slice(0, 41)}…` : name;
  return {
    formatted: tidy(parts.join("")),
    inText: `(${lead}, ${resolved.year || "n.d."})`,
  };
}

function mla(resolved: Resolved, sourceType: CitationSourceType): { formatted: string; inText: string } {
  const rawTitle = [resolved.title, resolved.subtitle].filter(Boolean).join(": ");
  const title = stripTrailingPeriod(headlineCase(rawTitle));
  const container = headlineCase(resolved.container);
  const parts: string[] = [];
  const authorBlock = resolved.authorText ? mlaAuthors(resolved.authors) : "";
  if (authorBlock) parts.push(`${authorBlock} `);
  // MLA quotes article/chapter titles but italicises standalone works such as books.
  if (title) parts.push(sourceType === "book" ? `${italics(title)}. ` : `"${title}." `);
  else if (!authorBlock && container) parts.push(`${italics(stripTrailingPeriod(container))}. `);

  if (sourceType === "journal") {
    const clause = joinClause([
      container ? italics(container) : "",
      resolved.volume ? `vol. ${resolved.volume}` : "",
      resolved.issue ? `no. ${resolved.issue}` : "",
      mlaDateOf(resolved),
      resolved.pages ? `pp. ${resolved.pages}` : "",
    ]);
    if (clause) parts.push(`${clause}. `);
  } else if (sourceType === "news") {
    const clause = joinClause([
      container ? italics(container) : "",
      mlaDateOf(resolved),
      resolved.pages ? `pp. ${resolved.pages}` : "",
    ]);
    if (clause) parts.push(`${clause}. `);
  } else if (sourceType === "book") {
    if (resolved.edition) parts.push(`${resolved.edition} ed., `);
    if (resolved.publisher) parts.push(`${resolved.publisher}, `);
    parts.push(`${resolved.year ? `${resolved.year}. ` : ""}`);
  } else if (sourceType === "manual") {
    if (container) parts.push(`${italics(container)}, `);
    if (resolved.reportNumber) parts.push(`no. ${resolved.reportNumber}, `);
    if (resolved.publisher) parts.push(`${resolved.publisher}, `);
    parts.push(`${resolved.year ? `${resolved.year}. ` : ""}`);
  } else {
    const clause = joinClause([container ? italics(container) : "", mlaDateOf(resolved)]);
    if (clause) parts.push(`${clause}, `);
  }

  const bareUrl = resolved.url.replace(/^https?:\/\/(?:www\.)?/iu, "").replace(/\/+$/u, "");
  if (bareUrl) parts.push(`${bareUrl}.`);
  else if (resolved.accessed) parts.push(`Accessed ${accessedDate(resolved.accessed, "mla")}.`);

  const first = resolved.authors[0];
  const lead = first ? surnameOf(first) : stripTrailingPeriod(title || container || "Untitled");
  const page = resolved.pages ? ` ${resolved.pages.split(/[-–]/u)[0]}` : "";
  return { formatted: tidy(parts.join("")), inText: `(${lead}${page})` };
}

function chicago(resolved: Resolved, sourceType: CitationSourceType): { formatted: string; inText: string } {
  const rawTitle = [resolved.title, resolved.subtitle].filter(Boolean).join(": ");
  const title = sentenceCase(stripTrailingPeriod(rawTitle));
  const parts: string[] = [];
  const authorBlock = resolved.authorText ? chicagoAuthors(resolved.authors) : "";
  if (authorBlock) parts.push(`${authorBlock} `);
  // No author: Chicago starts the entry with the title, unquoted for containers.
  if (!authorBlock) parts.push(`${title ? `${italics(title)}. ` : ""}`);

  const year = resolved.year || "n.d.";
  if (authorBlock || sourceType === "book" || sourceType === "manual") parts.push(`${yearClause(resolved.year)} `);
  if (authorBlock && title) {
    parts.push(`${sourceType === "book" || sourceType === "manual" ? `${italics(title)}.` : `"${title}."`} `);
  }

  if (sourceType === "journal") {
    let clause = resolved.container ? `${italics(resolved.container)} ` : "";
    if (resolved.volume) clause += `${resolved.volume}`;
    if (resolved.issue) clause += ` (no. ${resolved.issue})`;
    if (resolved.pages) clause += `: ${resolved.pages}`;
    if (clause.trim()) parts.push(`${clause}. `);
  } else if (sourceType === "news") {
    const date = resolved.month ? longDate(resolved, "month-day", PLAIN_MONTHS) : yearClause(resolved.year);
    const clause = joinClause([resolved.container ? italics(resolved.container) : "", date]);
    if (clause) parts.push(`${clause}. `);
    if (resolved.pages) parts.push(`${resolved.pages}. `);
  } else if (sourceType === "webpage") {
    if (resolved.container) parts.push(`${italics(resolved.container)}. `);
    if (resolved.month) parts.push(`${longDate(resolved, "month-day", PLAIN_MONTHS)}. `);
  } else {
    if (resolved.edition) parts.push(`${resolved.edition} ed. `);
    const pub = [resolved.place, resolved.publisher].filter(Boolean).join(": ");
    if (pub) parts.push(`${pub}. `);
  }

  if (resolved.doi) parts.push(`${resolved.doi}. `);
  else if (resolved.url) parts.push(`${resolved.url}. `);
  else if (resolved.accessed && sourceType === "webpage") parts.push(`Accessed ${accessedDate(resolved.accessed, "chicago")}. `);

  const first = resolved.authors[0];
  const lead = first ? surnameOf(first) : title || resolved.container || "Untitled";
  const page = resolved.pages ? `, ${resolved.pages.split(/[-–]/u)[0]}` : "";
  return {
    formatted: tidy(parts.join("")),
    inText: sourceType === "webpage" && !resolved.pages ? `(${lead} ${year})` : `(${lead} ${year}${page})`,
  };
}

function harvard(resolved: Resolved, sourceType: CitationSourceType): { formatted: string; inText: string } {
  const rawTitle = [resolved.title, resolved.subtitle].filter(Boolean).join(": ");
  const title = sentenceCase(stripTrailingPeriod(rawTitle));
  const authorBlock = resolved.authorText ? harvardAuthors(resolved.authors) : "";
  const parts: string[] = [];
  if (authorBlock) {
    parts.push(`${authorBlock} `);
    parts.push(`${yearClause(resolved.year)} `);
    if (title) {
      parts.push(sourceType === "journal" || sourceType === "news" ? `'${title}'. ` : `${italics(title)}. `);
    }
  } else {
    // No author to put first, so the title opens the entry and the year follows it.
    if (title) parts.push(`${italics(title)}. `);
    parts.push(`${yearClause(resolved.year)} `);
  }

  if (sourceType === "journal") {
    const details = `${resolved.volume}${resolved.issue ? `(${resolved.issue})` : ""}${resolved.pages ? `, pp. ${resolved.pages}` : ""}`;
    const clause = joinClause([resolved.container ? italics(resolved.container) : "", details]);
    if (clause) parts.push(`${clause}. `);
  } else if (sourceType === "news") {
    const date = resolved.month ? longDate(resolved, "day-month", PLAIN_MONTHS) : "";
    if (resolved.container || date) {
      parts.push(`${resolved.container ? italics(resolved.container) : ""}${date ? `, ${date}` : ""}. `);
    }
  } else if (sourceType === "book") {
    if (resolved.edition) parts.push(`${resolved.edition} edn. `);
    const pub = [resolved.place, resolved.publisher].filter(Boolean).join(": ");
    parts.push(`${pub ? `${pub}. ` : ""}`);
  } else if (sourceType === "manual") {
    if (resolved.reportNumber) parts.push(`${resolved.reportNumber}. `);
    if (resolved.publisher) parts.push(`${resolved.publisher}. `);
  } else if (sourceType === "webpage") {
    if (resolved.container) parts.push(`${italics(resolved.container)}. `);
  }

  if (resolved.doi && sourceType === "journal") parts.push(`doi: ${resolved.doi.replace(/^https?:\/\/doi\.org\//u, "")}. `);
  const link = resolved.url || (resolved.doi ? doiOf(resolved.doi) : "");
  const read = resolved.accessed ? ` (Accessed: ${accessedDate(resolved.accessed, "harvard")})` : "";
  if (link && sourceType !== "journal") parts.push(`Available at: ${link}${read}.`);
  else if (link) parts.push(`${link}.`);

  const lead = inTextSurname(resolved.authors) || title;
  const page = resolved.pages ? `: ${resolved.pages.split(/[-–]/u)[0]}` : "";
  return { formatted: tidy(parts.join("")), inText: `(${lead || "Untitled"}, ${resolved.year || "n.d."}${page})` };
}

function ieee(resolved: Resolved, sourceType: CitationSourceType): { formatted: string; inText: string } {
  const rawTitle = [resolved.title, resolved.subtitle].filter(Boolean).join(": ");
  const title = stripTrailingPeriod(sentenceCase(rawTitle));
  const parts: string[] = [];
  const authorBlock = resolved.authorText ? ieeeAuthors(resolved.authors) : "";
  if (authorBlock) parts.push(`${authorBlock}, `);
  if (sourceType === "book" || sourceType === "manual") {
    if (title) parts.push(`${italics(title)}, `);
  } else if (title) parts.push(`"${title}," `);

  if (sourceType === "journal") {
    const clause = joinClause([
      resolved.container ? italics(resolved.container) : "",
      resolved.volume ? `vol. ${resolved.volume}` : "",
      resolved.issue ? `no. ${resolved.issue}` : "",
      resolved.pages ? `pp. ${resolved.pages}` : "",
      ieeeDateOf(resolved),
    ]);
    if (clause) parts.push(`${clause}. `);
  } else if (sourceType === "news") {
    const clause = joinClause([resolved.container ? italics(resolved.container) : "", ieeeDateOf(resolved)]);
    if (clause) parts.push(`${clause}. `);
  } else if (sourceType === "book") {
    const pub = [resolved.place, resolved.publisher].filter(Boolean).join(": ");
    if (pub) parts.push(`${pub}, `);
    if (resolved.edition) parts.push(`${resolved.edition} ed. `);
    if (resolved.year) parts.push(`${yearClause(resolved.year)} `);
  } else if (sourceType === "manual") {
    if (resolved.reportNumber) parts.push(`no. ${resolved.reportNumber}, `);
    if (resolved.container) parts.push(`${italics(resolved.container)}, `);
    if (resolved.publisher) parts.push(`${resolved.publisher}, `);
    if (resolved.year) parts.push(`${yearClause(resolved.year)} `);
  } else {
    if (resolved.container) parts.push(`${italics(resolved.container)}, `);
    parts.push(`${resolved.year ? `${yearClause(resolved.year)} ` : ""}`);
  }

  if (resolved.doi) parts.push(`doi: ${resolved.doi.replace(/^https?:\/\/doi\.org\//u, "")}. `);
  if (resolved.url) parts.push(`[Online]. Available: ${resolved.url}.`);
  if (resolved.accessed) parts.push(` [Accessed: ${accessedDate(resolved.accessed, "ieee")}].`);

  const first = resolved.authors[0];
  const lead = first ? surnameOf(first) : title || resolved.container || "the cited work";
  // IEEE in-text is a bare bracketed number; the name is only a reader aid.
  return {
    formatted: tidy(parts.join("")),
    inText: `[1] ${lead}${resolved.year ? ` ${resolved.year}` : ""}`.replace(/\s+/gu, " ").trim(),
  };
}

function tidy(value: string): string {
  return value
    .replace(/\s+/gu, " ")
    .replace(/ ,/gu, ",")
    .replace(/\.\s*\./gu, ".")
    .replace(/,\s*\./gu, ".")
    .replace(/\s+\./gu, ".")
    .replace(/""/gu, "")
    .replace(/"\s*\.\s*"/gu, "\".")
    .replace(/,\s*$/gu, ".")
    .trim();
}

const BUILDERS: Record<CitationStyle, (resolved: Resolved, type: CitationSourceType) => { formatted: string; inText: string }> = {
  apa,
  mla,
  chicago,
  harvard,
  ieee,
};

export interface BuildCitationOptions {
  style: CitationStyle;
  sourceType: CitationSourceType;
  fields: CitationFields;
  id?: string;
  /** Reference number for numeric styles such as IEEE. */
  number?: number;
}

export function buildCitation(options: BuildCitationOptions): Citation {
  const fields = tidyFields(options.fields);
  const resolved: Resolved = {
    authors: parseAuthors(authorTextOf(fields)),
    authorText: authorTextOf(fields),
    year: /^\d{4}$/u.test(text(fields, "year")) ? text(fields, "year") : (text(fields, "year") || "").replace(/\D/gu, "").slice(0, 4),
    month: text(fields, "month"),
    day: text(fields, "day"),
    title: text(fields, "title"),
    subtitle: text(fields, "secondaryTitle"),
    container: text(fields, "containerTitle"),
    publisher: text(fields, "publisher"),
    place: text(fields, "place"),
    volume: text(fields, "volume"),
    issue: text(fields, "issue"),
    pages: pagesOf(fields, ["apa", "chicago", "harvard"].includes(options.style) ? "–" : "-"),
    edition: editionOf(fields),
    doi: doiOf(text(fields, "doi")),
    url: text(fields, "url"),
    accessed: text(fields, "accessed"),
    reportNumber: text(fields, "reportNumber"),
  };
  const built = BUILDERS[options.style](resolved, options.sourceType);
  const number = options.number ?? 1;
  const inText = options.style === "ieee" ? built.inText.replace(/^\[1\]/u, `[${number}]`) : built.inText;
  return {
    id: options.id || `cite_${options.style}_${options.sourceType}_${stableKey(built.formatted)}`,
    style: options.style,
    sourceType: options.sourceType,
    formatted: built.formatted,
    bibliographyEntry: built.formatted,
    inText,
    fields: keptFields(fields),
  };
}

/** One entry per style, so the UI can render a comparison table. */
export function buildAllStyles(sourceType: CitationSourceType, fields: CitationFields): Citation[] {
  return CITATION_STYLES.map((style) => buildCitation({ style: style.id, sourceType, fields }));
}

function tidyFields(fields: CitationFields): CitationFields {
  const out: CitationFields = {};
  for (const [key, value] of Object.entries(fields) as [CitationField, string | undefined][]) {
    if (typeof value === "string" && value.trim()) out[key] = normalizeText(value);
  }
  return out;
}

function keptFields(fields: CitationFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

function stableKey(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/* ------------------------------------------------------------- utilities -- */

/** `10.1000/xyz123` becomes a resolvable link. Parsing only — no lookup. */
export function parseDoi(doi: string): { valid: boolean; doi: string; url: string } {
  const raw = (doi || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//iu, "");
  const match = /^(10\.\d{4,9}\/\S+)$/u.exec(raw);
  if (!match) return { valid: false, doi: raw, url: "" };
  return { valid: true, doi: raw, url: `https://doi.org/${raw}` };
}

export interface ParsedUrl {
  valid: boolean;
  url: string;
  protocol: string;
  host: string;
  path: string;
  /** Best local guess at the site name; confirming it still needs a human. */
  suggestedContainer: string;
  /** Best local guess at the item title from the last path segment. */
  suggestedTitle: string;
}

const STOP_SEGMENTS = /^(index|home|article|articles|news|blog|page|pages|post|posts|read|view|detail|details|story|stories|html|en|us|www)$/iu;

export function parseUrl(url: string): ParsedUrl {
  const raw = (url || "").trim();
  const match = /^(https?):\/\/([^/?#]+)([^?#]*)/iu.exec(raw);
  if (!match) {
    return { valid: false, url: raw, protocol: "", host: "", path: "", suggestedContainer: "", suggestedTitle: "" };
  }
  const protocol = match[1] ?? "";
  const host = (match[2] ?? "").replace(/^www\./iu, "").toLowerCase();
  const path = match[3] ?? "";
  const segments = path.split("/").filter((segment) => segment.length > 0 && !STOP_SEGMENTS.test(segment));
  // Numeric ids and date slugs are never the title.
  const candidate = [...segments].reverse().find((segment) => !/^[\d\-_.a-z]+$/iu.test(segment) || segment.includes("-"));
  const title = (candidate ?? "")
    .replace(/\.(html?|aspx?|php|pdf|shtml)$/iu, "")
    .replace(/[-_+]+/gu, " ")
    .replace(/\b(?:19|20)\d{6,}\b/gu, "")
    .replace(/\b\d+\b/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const siteHead = host.split(".").slice(0, 1)[0] ?? "";
  return {
    valid: true,
    url: raw,
    protocol,
    host,
    path,
    suggestedContainer: siteHead ? siteHead.charAt(0).toUpperCase() + siteHead.slice(1) : "",
    suggestedTitle: title.length > 8 ? sentenceCase(title) : "",
  };
}

/** Bibliography lists sort by surname, then year, then title. */
export function citationSortKey(citation: Citation): string {
  const authors = parseAuthors(citation.fields["authors"] ?? citation.fields["corporateAuthor"] ?? "");
  const surname = authors[0] ? surnameOf(authors[0]) : citation.fields["containerTitle"] ?? citation.fields["title"] ?? "zzz";
  return `${surname.toLowerCase()}|${citation.fields["year"] ?? "0000"}|${(citation.fields["title"] ?? "").toLowerCase()}`;
}

export function sortBibliography(citations: Citation[]): Citation[] {
  return [...citations].sort((a, b) => citationSortKey(a).localeCompare(citationSortKey(b)));
}

/** IEEE numbers follow list order, so re-number after sorting. */
export function numberReferences(citations: Citation[]): Citation[] {
  return citations.map((citation, index) => ({
    ...citation,
    inText: citation.style === "ieee" ? citation.inText.replace(/^\[\d+\]/u, `[${index + 1}]`) : citation.inText,
  }));
}

/** Narrative form: "Smith (2019)" from the parenthetical "(Smith, 2019)". */
export function inTextNarrative(citation: Citation): string {
  if (citation.style === "ieee") return citation.inText.replace(/^\[\d+\]\s*/u, "");
  const inner = citation.inText.replace(/^\((.*)\)$/u, "$1");
  const parts = inner.split(/,\s*(?=\d{4}|n\.d\.|pp?\.|\d)/u);
  if (parts.length < 2) return inner;
  return `${parts.slice(0, -1).join(", ")} (${parts[parts.length - 1]})`;
}

export function inTextParenthetical(citation: Citation): string {
  return citation.style === "ieee" ? citation.inText.replace(/^\s*\S+\s+/u, "").trim() || citation.inText : citation.inText;
}

/** Worked examples the tool ships with, one per style, for the empty state. */
export const CITATION_EXAMPLES: { style: CitationStyle; sourceType: CitationSourceType; fields: CitationFields }[] = [
  {
    style: "apa",
    sourceType: "journal",
    fields: {
      authors: "Clifford Cunningham and Nina Zhao",
      year: "2023",
      title: "Audit sampling in model-assisted surveys",
      secondaryTitle: "design and field results",
      containerTitle: "Journal of Survey Statistics",
      volume: "14",
      issue: "2",
      pageFrom: "118",
      pageTo: "141",
      doi: "10.1093/jss/adx118",
    },
  },
  {
    style: "mla",
    sourceType: "book",
    fields: {
      authors: "Rebecca Halloran",
      year: "2021",
      title: "The Quiet Archive",
      secondaryTitle: "Memory and the Digital Record",
      publisher: "Meridian Press",
      edition: "2nd",
    },
  },
  {
    style: "chicago",
    sourceType: "news",
    fields: {
      authors: "Tom Ferreira",
      year: "2024",
      month: "3",
      day: "14",
      title: "City reopens the river after a decade of cleanup",
      containerTitle: "The Ledger Review",
      url: "https://news.example.com/river-cleanup-2024",
    },
  },
  {
    style: "harvard",
    sourceType: "webpage",
    fields: {
      corporateAuthor: "World Health Organization",
      year: "2022",
      title: "Guidelines on indoor air quality",
      containerTitle: "WHO",
      publisher: "World Health Organization",
      url: "https://www.who.example.int/publications/iaq",
      accessed: "2024-05-02",
    },
  },
  {
    style: "ieee",
    sourceType: "journal",
    fields: {
      authors: "A. R. Okonkwo and M. Lindqvist",
      year: "2020",
      title: "Low-latency inference on constrained edge devices",
      containerTitle: "IEEE Transactions on Edge Computing",
      volume: "7",
      issue: "4",
      pageFrom: "301",
      pageTo: "315",
      doi: "10.1109/tec.2020.3012345",
    },
  },
];

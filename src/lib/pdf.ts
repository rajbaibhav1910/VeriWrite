/**
 * A small text-only PDF writer.
 *
 * It emits a valid PDF 1.4 file using the three base-14 Helvetica faces every
 * reader ships with, so no font has to be embedded and no library has to be
 * downloaded. It handles headings, wrapped paragraphs, key/value rows, rules and
 * page breaks — which is everything a detection report needs. Numbers are laid
 * out with the fonts' real advance widths, so columns line up.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 64;

type Face = "regular" | "bold" | "italic";

const FONT_RES: Record<Face, string> = { regular: "F1", bold: "F2", italic: "F3" };
const BASE_FONT: Record<Face, string> = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
};

/** Advance widths in 1/1000 em, indexed by byte value, for Helvetica. */
const HELVETICA: Record<number, number> = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191, 40: 333, 41: 333,
  42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278, 58: 278, 59: 278, 60: 584, 61: 584,
  62: 584, 63: 556, 64: 1015, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556, 96: 333,
  123: 334, 124: 260, 125: 334, 126: 584,
};
for (let code = 48; code <= 57; code += 1) HELVETICA[code] = 556;
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const UPPER_W = [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const LOWER_W = [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500];
UPPER.split("").forEach((letter, i) => {
  HELVETICA[letter.charCodeAt(0)] = UPPER_W[i];
});
LOWER.split("").forEach((letter, i) => {
  HELVETICA[letter.charCodeAt(0)] = LOWER_W[i];
});

/** WinAnsi punctuation that sits above the ASCII range and has a real width. */
const PUNCT_W: Record<number, number> = {
  0x80: 556, 0x85: 1000, 0x91: 191, 0x92: 191, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556,
  0x97: 1000, 0x99: 1000,
};

/** Helvetica-Bold advances, used only where the weight differs enough to matter. */
const HELVETICA_BOLD: Record<number, number> = {
  32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 238, 40: 333, 41: 333,
  42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278, 58: 333, 59: 333, 60: 584, 61: 584,
  62: 584, 63: 611, 64: 975, 91: 333, 92: 278, 93: 333, 94: 584, 95: 556, 96: 333,
  123: 389, 124: 280, 125: 389, 126: 584,
};
for (let code = 48; code <= 57; code += 1) HELVETICA_BOLD[code] = 556;
const UPPER_BW = [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
const LOWER_BW = [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500];
UPPER.split("").forEach((letter, i) => {
  HELVETICA_BOLD[letter.charCodeAt(0)] = UPPER_BW[i];
});
LOWER.split("").forEach((letter, i) => {
  HELVETICA_BOLD[letter.charCodeAt(0)] = LOWER_BW[i];
});
Object.entries(PUNCT_W).forEach(([byte, width]) => {
  HELVETICA[Number(byte)] = width;
});
Object.entries({ ...PUNCT_W, 0x91: 238, 0x92: 238, 0x93: 389, 0x94: 389, 0x95: 416 }).forEach(
  ([byte, width]) => {
    HELVETICA_BOLD[Number(byte)] = width;
  },
);

/** Punctuation that is not Latin-1 in Unicode but is in WinAnsi. */
const WIN_ANSI: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function byteOf(code: number): number {
  if (code < 128) return code;
  const mapped = WIN_ANSI[code];
  if (mapped !== undefined) return mapped;
  if (code >= 160 && code <= 255) return code;
  return 63; // "?" for anything the base-14 faces cannot draw
}

function escapeText(value: string): string {
  let out = "";
  for (const character of value) {
    const byte = byteOf(character.codePointAt(0) ?? 63);
    const char = String.fromCharCode(byte);
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else out += char;
  }
  return out;
}

function widthOf(value: string, face: Face, size: number): number {
  const table = face === "bold" ? HELVETICA_BOLD : HELVETICA;
  let total = 0;
  for (const character of value) {
    total += table[byteOf(character.codePointAt(0) ?? 63)] ?? 556;
  }
  return (total / 1000) * size;
}

function wrap(value: string, face: Face, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/u).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (widthOf(candidate, face, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/** A grey tone as an `rg` operator; 0 is black, 1 is white. */
function grayFill(value: number): string {
  const tone = value.toFixed(3);
  return `${tone} ${tone} ${tone} rg`;
}

export interface PdfStyle {
  size?: number;
  face?: Face;
  valueFace?: Face;
  /** 0-1; 0 is black. */
  tone?: number;
  indent?: number;
  leading?: number;
}

export class PdfDocument {
  private pages: string[][] = [];
  private ops: string[] = [];
  private y = PAGE_HEIGHT - MARGIN_TOP;

  constructor(readonly meta: { title: string; author: string }) {
    this.newPage();
  }

  private newPage() {
    if (this.ops.length > 0) this.pages.push(this.ops);
    this.ops = [];
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private get contentWidth(): number {
    return PAGE_WIDTH - MARGIN_X * 2;
  }

  private fits(height: number): boolean {
    return this.y - height >= MARGIN_BOTTOM;
  }

  private ensure(height: number) {
    if (!this.fits(height)) this.newPage();
  }

  /** `y` counts down from the top of the page; PDF baselines count up from the bottom. */
  private baseline(size: number): number {
    return PAGE_HEIGHT - this.y - size * 0.85;
  }

  text(value: string, style: PdfStyle = {}) {
    const size = style.size ?? 10;
    const face = style.face ?? "regular";
    const leading = style.leading ?? size * 1.45;
    const indent = style.indent ?? 0;
    const lines = wrap(value, face, size, this.contentWidth - indent);
    for (const line of lines) {
      this.ensure(leading);
      this.ops.push(
        `BT ${grayFill(style.tone ?? 0)} /${FONT_RES[face]} ${size} Tf 1 0 0 1 ${(
          MARGIN_X + indent
        ).toFixed(2)} ${this.baseline(size).toFixed(2)} Tm (${escapeText(line)}) Tj ET`,
      );
      this.y -= leading;
    }
  }

  /** Two columns on one line: a label at the left, a figure at the right edge. */
  row(label: string, value: string, style: PdfStyle = {}) {
    const size = style.size ?? 10;
    const leading = style.leading ?? size * 1.5;
    this.ensure(leading);
    const valueWidth = widthOf(value, style.valueFace ?? "regular", size);
    const gap = 12;
    const labelMax = this.contentWidth - valueWidth - gap;
    let shownLabel = label;
    while (widthOf(shownLabel, style.face ?? "regular", size) > labelMax && shownLabel.length > 1) {
      shownLabel = shownLabel.slice(0, -2);
      if (widthOf(`${shownLabel}...`, style.face ?? "regular", size) <= labelMax) {
        shownLabel = `${shownLabel}...`;
        break;
      }
    }
    const baseline = this.baseline(size);
    this.ops.push(
      `BT ${grayFill(0)} /${FONT_RES[style.face ?? "regular"]} ${size} Tf 1 0 0 1 ${MARGIN_X.toFixed(2)} ${baseline.toFixed(
        2,
      )} Tm (${escapeText(shownLabel)}) Tj ET`,
      `BT ${grayFill(0)} /${FONT_RES[style.valueFace ?? "regular"]} ${size} Tf 1 0 0 1 ${(
        PAGE_WIDTH -
        MARGIN_X -
        valueWidth
      ).toFixed(2)} ${baseline.toFixed(2)} Tm (${escapeText(value)}) Tj ET`,
    );
    this.y -= leading;
  }

  rule(tone = 0.85, gap = 6) {
    this.ensure(1 + gap * 2);
    this.y -= gap;
    this.ops.push(
      `${grayFill(tone)} ${MARGIN_X.toFixed(2)} ${(PAGE_HEIGHT - this.y - 1).toFixed(2)} ${this.contentWidth.toFixed(
        2,
      )} 1 re f`,
    );
    this.y -= gap;
  }

  /** A labelled proportion bar: the four-class breakdown reads as one picture. */
  meter(label: string, percent: number, style: PdfStyle = {}) {
    const size = style.size ?? 9.5;
    const leading = Math.max(size * 1.5, 15);
    this.ensure(leading);
    const baseline = this.baseline(size);
    const barWidth = this.contentWidth * 0.45;
    const barX = PAGE_WIDTH - MARGIN_X - barWidth;
    const filled = (Math.min(100, Math.max(0, percent)) / 100) * barWidth;
    this.ops.push(
      `BT ${grayFill(0)} /${FONT_RES[style.face ?? "regular"]} ${size} Tf 1 0 0 1 ${MARGIN_X.toFixed(
        2,
      )} ${baseline.toFixed(2)} Tm (${escapeText(label)}) Tj ET`,
      `${grayFill(0.92)} ${barX.toFixed(2)} ${(baseline - 1).toFixed(2)} ${barWidth.toFixed(2)} 7 re f`,
      `${grayFill(0.45)} ${barX.toFixed(2)} ${(baseline - 1).toFixed(2)} ${filled.toFixed(2)} 7 re f`,
    );
    this.y -= leading;
  }

  space(amount = 8) {
    this.ensure(amount);
    this.y -= amount;
  }

  heading(value: string) {
    this.ensure(34);
    this.text(value, { size: 11, face: "bold", tone: 0, leading: 15 });
    this.rule(0.8, 4);
  }

  /** Page numbers can only be written once the page count is known. */
  private footer(page: number, total: number, label: string) {
    return `BT ${grayFill(0.45)} /${FONT_RES.italic} 8 Tf 1 0 0 1 ${MARGIN_X.toFixed(2)} ${(MARGIN_BOTTOM / 2).toFixed(
      2,
    )} Tm (${escapeText(label)}) Tj ET BT ${grayFill(0.45)} /${FONT_RES.regular} 8 Tf 1 0 0 1 ${(
      PAGE_WIDTH -
      MARGIN_X -
      widthOf(`Page ${page} of ${total}`, "regular", 8)
    ).toFixed(2)} ${(MARGIN_BOTTOM / 2).toFixed(2)} Tm (${escapeText(`Page ${page} of ${total}`)}) Tj ET`;
  }

  build(): string {
    const body = [...this.pages, this.ops];
    const total = body.length;
    const objects: string[] = [];
    // 1 catalog, 2 pages, 3-5 fonts, 6 info; page objects then streams.
    const firstPageObj = 7;
    const kids = body.map((_, index) => `${firstPageObj + index * 2} 0 R`).join(" ");

    objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
    objects.push(`<< /Type /Pages /Count ${total} /Kids [${kids}] >>`);
    (["regular", "bold", "italic"] as const).forEach((face) => {
      objects.push(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${BASE_FONT[face]} /Encoding /WinAnsiEncoding >>`,
      );
    });
    objects.push(
      `<< /Title (${escapeText(this.meta.title)}) /Author (${escapeText(
        this.meta.author,
      )}) /Creator (VeriWrite) /Producer (VeriWrite report writer) >>`,
    );

    body.forEach((ops, index) => {
      const content = ops.concat([
        this.footer(index + 1, total, `${this.meta.title} - VeriWrite report`),
      ]);
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(
          2,
        )}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${
          firstPageObj + index * 2 + 1
        } 0 R >>`,
      );
      const stream = `q 1 0 0 1 0 0 cm\n${content.join("\n")}\nQ`;
      objects.push(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    });

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((object, index) => {
      offsets.push(byteLength(out));
      out += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefAt = byteLength(out);
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
      out += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    out += `trailer << /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    return out;
  }
}

function byteLength(value: string): number {
  // Every emitted character is Latin-1 or ASCII, so one byte per character.
  return value.length;
}

/**
 * Turn a finished document into file bytes. The Latin-1 mapping has to stay here:
 * a UTF-8 encoder would inflate the WinAnsi bytes and break the offset table that
 * every reader uses to find the pages.
 */
export function pdfBytes(document: PdfDocument): Uint8Array {
  const text = document.build();
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff;
  return bytes;
}

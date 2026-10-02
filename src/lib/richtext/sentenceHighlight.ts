import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ConfidenceLevel, SignalKind } from "@/types";

export const sentenceHighlightKey = new PluginKey("vwSentenceHighlight");

export interface SentenceDecoration {
  /** ProseMirror range holding the sentence. */
  from: number;
  to: number;
  /** Sentence index in the analysis, carried into the DOM for hover and click. */
  index: number;
  signal: SignalKind;
  aiProbability: number;
  confidence: ConfidenceLevel;
  flagged: boolean;
  selected: boolean;
  scoreVisible: boolean;
}

interface HighlightState {
  decorations: SentenceDecoration[];
}

const EMPTY: HighlightState = { decorations: [] };

/** Identity of a highlight set, so unchanged work is not dispatched again on every keystroke. */
function signature(list: SentenceDecoration[]): string {
  return list
    .map(
      (d) =>
        `${d.index}:${d.from}-${d.to}:${d.signal}:${d.selected ? 1 : 0}:${d.scoreVisible ? 1 : 0}:${d.flagged ? 1 : 0}`,
    )
    .join("|");
}

function attributesFor(decoration: SentenceDecoration) {
  return {
    class: [
      "vw-sentence",
      `vw-sentence--${decoration.signal}`,
      decoration.flagged ? "vw-sentence--flagged" : "",
      decoration.selected ? "vw-sentence--selected" : "",
      decoration.scoreVisible ? "vw-sentence--scored" : "",
    ]
      .filter(Boolean)
      .join(" "),
    "data-sentence": String(decoration.index),
    "data-signal": decoration.signal,
    "data-score": String(decoration.aiProbability),
    "data-confidence": decoration.confidence,
    "data-flagged": decoration.flagged ? "true" : "false",
  };
}

/**
 * Paints analysed sentences over the live document. It stores nothing about the
 * text itself: the page hands it document ranges that were traced from the
 * analysis offsets. When the document changes the ranges follow the text through
 * the transaction's position map, so reformatting a sentence keeps its mark while
 * an edit that changes the text leaves the page to retrace or drop them.
 */
export const SentenceHighlight = Extension.create({
  name: "sentenceHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<HighlightState>({
        key: sentenceHighlightKey,
        state: {
          init: () => EMPTY,
          apply: (tr, value) => {
            const meta = tr.getMeta(sentenceHighlightKey) as HighlightState | undefined;
            if (meta) return meta;
            if (!tr.docChanged) return value;
            // A range that no longer holds any text cannot carry a mark.
            const carried = value.decorations
              .map((decoration) => ({
                ...decoration,
                from: tr.mapping.map(decoration.from, 1),
                to: tr.mapping.map(decoration.to, -1),
              }))
              .filter((decoration) => decoration.from < decoration.to);
            return { decorations: carried };
          },
        },
        props: {
          decorations: (state) => {
            const stored = sentenceHighlightKey.getState(state) as HighlightState | undefined;
            const decorations = stored?.decorations ?? EMPTY.decorations;
            return DecorationSet.create(
              state.doc,
              decorations.map((decoration) =>
                Decoration.inline(
                  decoration.from,
                  decoration.to,
                  attributesFor(decoration),
                ),
              ),
            );
          },
        },
      }),
    ];
  },
});

/** Replaces the painted sentences; an empty list clears them. */
export function setSentenceDecorations(editor: Editor, decorations: SentenceDecoration[]) {
  const current = sentenceHighlightKey.getState(editor.state);
  if (current && signature(current.decorations) === signature(decorations)) return;
  editor.view.dispatch(editor.state.tr.setMeta(sentenceHighlightKey, { decorations }));
}

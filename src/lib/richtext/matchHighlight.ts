import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const matchHighlightKey = new PluginKey("vwMatchHighlight");

/** How a passage was judged to overlap a source. */
export type MatchKind = "verbatim" | "near-paraphrase";

export interface MatchDecoration {
  /** ProseMirror range holding the matched words. */
  from: number;
  to: number;
  id: string;
  kind: MatchKind;
  selected: boolean;
}

interface MatchState {
  decorations: MatchDecoration[];
}

const EMPTY: MatchState = { decorations: [] };

/** Identity of a mark set, so unchanged work is not dispatched again on every keystroke. */
function signature(list: MatchDecoration[]): string {
  return list
    .map((d) => `${d.id}:${d.from}-${d.to}:${d.kind}:${d.selected ? 1 : 0}`)
    .join("|");
}

function attributesFor(decoration: MatchDecoration) {
  return {
    class: [
      "vw-match",
      `vw-match--${decoration.kind}`,
      decoration.selected ? "vw-match--selected" : "",
    ]
      .filter(Boolean)
      .join(" "),
    "data-match": decoration.id,
    "data-kind": decoration.kind,
  };
}

/**
 * Paints matched passages over the live document, the same way the sentence and
 * issue marks work: the page supplies document ranges traced from the scanner's
 * own offsets, and ranges follow the text through a transaction's position map.
 * A match is evidence about a span of the reader's text, so it is drawn as a mark
 * and never written into the document.
 */
export const MatchHighlight = Extension.create({
  name: "matchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<MatchState>({
        key: matchHighlightKey,
        state: {
          init: () => EMPTY,
          apply: (tr, value) => {
            const meta = tr.getMeta(matchHighlightKey) as MatchState | undefined;
            if (meta) return meta;
            if (!tr.docChanged) return value;
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
            const stored = matchHighlightKey.getState(state) as MatchState | undefined;
            const decorations = stored?.decorations ?? EMPTY.decorations;
            return DecorationSet.create(
              state.doc,
              decorations.map((decoration) =>
                Decoration.inline(decoration.from, decoration.to, attributesFor(decoration)),
              ),
            );
          },
        },
      }),
    ];
  },
});

/** Replaces the painted matches; an empty list clears them. */
export function setMatchDecorations(editor: Editor, decorations: MatchDecoration[]) {
  const current = matchHighlightKey.getState(editor.state);
  if (current && signature(current.decorations) === signature(decorations)) return;
  editor.view.dispatch(editor.state.tr.setMeta(matchHighlightKey, { decorations }));
}

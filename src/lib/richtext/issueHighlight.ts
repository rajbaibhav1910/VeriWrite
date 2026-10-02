import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { GrammarIssueState, IssueCategory } from "@/types";

export const issueHighlightKey = new PluginKey("vwIssueHighlight");

export interface IssueDecoration {
  /** ProseMirror range holding the flagged text. */
  from: number;
  to: number;
  id: string;
  category: IssueCategory;
  state: GrammarIssueState;
  selected: boolean;
}

interface IssueState {
  decorations: IssueDecoration[];
}

const EMPTY: IssueState = { decorations: [] };

/** Identity of a mark set, so unchanged work is not dispatched again on every keystroke. */
function signature(list: IssueDecoration[]): string {
  return list
    .map((d) => `${d.id}:${d.from}-${d.to}:${d.category}:${d.state}:${d.selected ? 1 : 0}`)
    .join("|");
}

function attributesFor(decoration: IssueDecoration) {
  return {
    class: [
      "vw-issue",
      `vw-issue--${decoration.category}`,
      `vw-issue--${decoration.state}`,
      decoration.selected ? "vw-issue--selected" : "",
    ]
      .filter(Boolean)
      .join(" "),
    "data-issue": decoration.id,
    "data-category": decoration.category,
    "data-state": decoration.state,
  };
}

/**
 * Paints grammar findings over the live document, the same way the sentence
 * marks work: the page supplies document ranges traced from the checker's own
 * offsets, and ranges follow the text through a transaction's position map when
 * the document is reformatted. Unlike the detection marks these carry a state,
 * so an accepted or ignored finding can look different without being repainted
 * from scratch.
 */
export const IssueHighlight = Extension.create({
  name: "issueHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<IssueState>({
        key: issueHighlightKey,
        state: {
          init: () => EMPTY,
          apply: (tr, value) => {
            const meta = tr.getMeta(issueHighlightKey) as IssueState | undefined;
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
            const stored = issueHighlightKey.getState(state) as IssueState | undefined;
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

/** Replaces the painted findings; an empty list clears them. */
export function setIssueDecorations(editor: Editor, decorations: IssueDecoration[]) {
  const current = issueHighlightKey.getState(editor.state);
  if (current && signature(current.decorations) === signature(decorations)) return;
  editor.view.dispatch(editor.state.tr.setMeta(issueHighlightKey, { decorations }));
}

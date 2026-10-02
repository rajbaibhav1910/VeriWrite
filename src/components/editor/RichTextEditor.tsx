import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type ReactNode,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Upload } from "lucide-react";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import { countCharacters, countWords, readingTimeSeconds, splitSentences } from "@/lib/text";
import { describeUploadSupport, formatBytes } from "@/services/fileService";
import { detectorExtensions } from "@/lib/richtext/extensions";
import { DETECTION_BLOCK_SEPARATOR, textToEditorHtml } from "@/lib/richtext/serialize";
import {
  mapIssueRangesToDocument,
  mapNormalizedSpansToDocument,
  mapSentencesToDocument,
} from "@/lib/richtext/offsets";
import {
  setIssueDecorations,
  type IssueDecoration,
} from "@/lib/richtext/issueHighlight";
import {
  setMatchDecorations,
  type MatchDecoration,
  type MatchKind,
} from "@/lib/richtext/matchHighlight";
import {
  setSentenceDecorations,
  type SentenceDecoration,
} from "@/lib/richtext/sentenceHighlight";
import { sentenceMatchesFilter, type SentenceFilter } from "@/lib/detection/filters";
import type { GrammarIssue, SentenceAnalysis } from "@/types";

export interface RichTextEditorHandle {
  /** Replace the whole document from plain text: uploads, imports and examples. */
  loadText(text: string): void;
  /** Insert plain text at the caret, keeping the current selection's formatting off. */
  insertText(text: string): void;
  /**
   * Plain text of the current selection, or an empty string when the caret is just
   * sitting there. The assistant works on this instead of the whole document.
   */
  getSelectionText(): string;
  /**
   * Write a checker's corrections into the document at the ranges it reported, in
   * one undoable step, keeping the formatting around them. False when a range can
   * no longer be traced to the text it quotes, so nothing is half-applied.
   */
  replaceRanges(
    replacements: { start: number; end: number; original: string; text: string }[],
  ): boolean;
  focus(): void;
}

/** A finished analysis, pinned to the exact text it was made from. */
export interface EditorAnalysis {
  sentences: SentenceAnalysis[];
  analysedText: string;
}

/** Grammar findings, pinned to the exact text the checker read. */
export interface EditorIssues {
  issues: GrammarIssue[];
  checkedText: string;
}

/** One passage the scanner found, in the form the editor paints. */
export interface EditorMatchSpan {
  id: string;
  start: number;
  end: number;
  kind: MatchKind;
}

/** Matched passages, pinned to the exact text the scanner read. */
export interface EditorMatches {
  spans: EditorMatchSpan[];
  scannedText: string;
}

export interface HighlightStatus {
  /** Sentences whose ranges were traced into this document. */
  mapped: number;
  /** Of those, how many the current filter leaves painted. */
  painted: number;
  /** Sentences the mapping refused to place. */
  unmapped: number;
  reason: string | null;
}

export interface RichTextEditorProps {
  /** Editor HTML read from the draft; an empty string starts an empty document. */
  initialHtml: string;
  /** Fires on mount with the loaded document and after every change. */
  onChange(text: string, html: string): void;
  onPaste(): void;
  onUpload(): void;
  onImport(): void;
  onFiles(files: File[]): void;
  /** Rendered between the metrics and the validation line in the footer. */
  status?: ReactNode;
  minWords: number;
  maxWords: number;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel: string;
  /** Set while the draft autosave runs, so the footer can say so truthfully. */
  savedAt?: string | null;
  /** Sentence findings to paint over the document, with the text they came from. */
  analysis?: EditorAnalysis | null;
  selectedSentence?: number | null;
  sentenceFilter?: SentenceFilter;
  showSentenceScores?: boolean;
  onSentenceSelect?(index: number | null): void;
  onSentenceHover?(payload: { index: number; rect: DOMRect } | null): void;
  onHighlightStatus?(info: HighlightStatus): void;
  /** Grammar findings to paint, already narrowed to the ones worth showing. */
  issues?: EditorIssues | null;
  selectedIssue?: string | null;
  onIssueSelect?(id: string | null): void;
  onIssueHover?(payload: { id: string; rect: DOMRect } | null): void;
  /** Matched passages to paint, from the scan of the text this document holds. */
  matches?: EditorMatches | null;
  selectedMatch?: string | null;
  onMatchSelect?(id: string | null): void;
  onMatchHover?(payload: { id: string; rect: DOMRect } | null): void;
}

/**
 * The writing surface every tool shares: a TipTap document editor whose marks and
 * blocks are real, with file intake by button and drag/drop and live counts taken
 * from the same primitives the detection engine uses.
 *
 * Two strings leave this component: the HTML, which is what the draft stores so
 * formatting survives a reload, and the plain text, which is what the engines
 * analyse. Detection and grammar offsets refer to that plain text, so both kinds
 * of mark are traced through it into document positions instead of being guessed
 * from the HTML.
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    {
      initialHtml,
      onChange,
      onPaste,
      onUpload,
      onImport,
      onFiles,
      status,
      minWords,
      maxWords,
      disabled = false,
      placeholder = "Paste your text here...",
      ariaLabel,
      savedAt,
      analysis = null,
      selectedSentence = null,
      sentenceFilter = "all",
      showSentenceScores = false,
      onSentenceSelect,
      onSentenceHover,
      onHighlightStatus,
      issues = null,
      selectedIssue = null,
      onIssueSelect,
      onIssueHover,
      matches = null,
      selectedMatch = null,
      onMatchSelect,
      onMatchHover,
    },
    ref,
  ) {
    const [dragging, setDragging] = useState(0);
    const [text, setText] = useState("");
    const onChangeRef = useRef(onChange);
    const onFilesRef = useRef(onFiles);
    const handlersRef = useRef({
      onSentenceSelect,
      onSentenceHover,
      onHighlightStatus,
      onIssueSelect,
      onIssueHover,
      onMatchSelect,
      onMatchHover,
    });
    const lastStatus = useRef<string>("");

    useEffect(() => {
      onChangeRef.current = onChange;
      onFilesRef.current = onFiles;
      handlersRef.current = {
        onSentenceSelect,
        onSentenceHover,
        onHighlightStatus,
        onIssueSelect,
        onIssueHover,
        onMatchSelect,
        onMatchHover,
      };
    });

    const editor = useEditor(
      {
        extensions: detectorExtensions(placeholder),
        content: initialHtml,
        editable: !disabled,
        editorProps: {
          attributes: {
            "aria-label": ariaLabel,
            "aria-describedby": `${ariaLabel}-metrics`,
            spellcheck: "true",
          },
          handleDOMEvents: {
            // Files dropped on the document are ours, not the editor's: ProseMirror
            // would otherwise consume the event and insert nothing.
            drop: (_view, event) => {
              const files = Array.from(event.dataTransfer?.files ?? []);
              if (files.length === 0 || disabled) return false;
              event.preventDefault();
              setDragging(0);
              onFilesRef.current(files);
              return true;
            },
          },
        },
        onUpdate: ({ editor: instance }) => {
          const plain = instance.getText({ blockSeparator: DETECTION_BLOCK_SEPARATOR });
          setText(plain);
          onChangeRef.current(plain, instance.getHTML());
        },
      },
      // The document is seeded once; content changes go through commands from there.
      [],
    );

    // Report the loaded draft so word counts, validation and the autosave guard all
    // start from the same text the engine will analyse.
    useEffect(() => {
      if (!editor) return;
      const plain = editor.getText({ blockSeparator: DETECTION_BLOCK_SEPARATOR });
      setText(plain);
      onChangeRef.current(plain, editor.getHTML());
    }, [editor]);

    useEffect(() => {
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    // Sentence marks are painted only while the document still holds the exact text
    // that was analysed; the comparison is a plain string check, so typing does not
    // trigger a document walk.
    useEffect(() => {
      if (!editor) return;
      const data = analysis;

      const report = (info: HighlightStatus) => {
        const key = `${info.mapped}/${info.painted}/${info.unmapped}/${info.reason ?? ""}`;
        if (key === lastStatus.current) return;
        lastStatus.current = key;
        handlersRef.current.onHighlightStatus?.(info);
      };

      if (!data || data.analysedText !== text || text.length === 0) {
        setSentenceDecorations(editor, []);
        report({
          mapped: 0,
          painted: 0,
          unmapped: data?.sentences.length ?? 0,
          reason: data && text.length > 0 ? "the editor no longer holds the analysed text" : null,
        });
        return;
      }

      const mapping = mapSentencesToDocument(data.sentences, data.analysedText, editor.state.doc);
      const decorations: SentenceDecoration[] = mapping.mapped
        .filter((entry) => sentenceMatchesFilter(entry.sentence, sentenceFilter))
        .map((entry) => ({
          from: entry.from,
          to: entry.to,
          index: entry.sentence.index,
          signal: entry.sentence.signal,
          aiProbability: entry.sentence.aiProbability,
          confidence: entry.sentence.confidence,
          flagged: entry.sentence.flagged,
          selected: selectedSentence === entry.sentence.index,
          scoreVisible: showSentenceScores,
        }));

      setSentenceDecorations(editor, decorations);
      report({
        mapped: mapping.mapped.length,
        painted: decorations.length,
        unmapped: mapping.unmapped,
        reason: mapping.reason,
      });
    }, [editor, analysis, text, selectedSentence, sentenceFilter, showSentenceScores]);

    // Grammar marks follow the same rule: they exist only while the document holds
    // the exact text the checker read.
    useEffect(() => {
      if (!editor) return;
      if (!issues || issues.checkedText !== text || text.length === 0) {
        setIssueDecorations(editor, []);
        return;
      }

      const mapping = mapIssueRangesToDocument(issues.issues, issues.checkedText, editor.state.doc);
      const decorations: IssueDecoration[] = mapping.mapped.map((entry) => ({
        from: entry.from,
        to: entry.to,
        id: entry.item.id,
        category: entry.item.category,
        state: entry.item.state,
        selected: selectedIssue === entry.item.id,
      }));

      setIssueDecorations(editor, decorations);
    }, [editor, issues, text, selectedIssue]);

    // Match marks follow the same rule again. The scanner measures the normalised form
    // of the text, so its spans go through the normalised mapping direction.
    useEffect(() => {
      if (!editor) return;
      if (!matches || matches.scannedText !== text || text.length === 0) {
        setMatchDecorations(editor, []);
        return;
      }

      const mapping = mapNormalizedSpansToDocument(matches.spans, matches.scannedText, editor.state.doc);
      const decorations: MatchDecoration[] = mapping.mapped.map((entry) => ({
        from: entry.from,
        to: entry.to,
        id: entry.item.id,
        kind: entry.item.kind,
        selected: selectedMatch === entry.item.id,
      }));

      setMatchDecorations(editor, decorations);
    }, [editor, matches, text, selectedMatch]);

    function sentenceElementAt(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("[data-sentence]");
    }

    function issueElementAt(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("[data-issue]");
    }

    function matchElementAt(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("[data-match]");
    }

    useImperativeHandle(
      ref,
      () => ({
        loadText(value: string) {
          editor?.chain().focus().setContent(textToEditorHtml(value)).run();
        },
        insertText(value: string) {
          editor?.chain().focus().insertContent(textToEditorHtml(value)).run();
        },
        getSelectionText() {
          if (!editor) return "";
          const { from, to } = editor.state.selection;
          if (from === to) return "";
          return editor.state.doc.textBetween(from, to, DETECTION_BLOCK_SEPARATOR, "\n").trim();
        },
        replaceRanges(replacements) {
          if (!editor || replacements.length === 0) return false;
          const plain = editor.getText({ blockSeparator: DETECTION_BLOCK_SEPARATOR });
          const mapping = mapIssueRangesToDocument(replacements, plain, editor.state.doc);
          if (mapping.mapped.length !== replacements.length) return false;

          // Later ranges first, so no replacement shifts a position still to use.
          const ordered = [...mapping.mapped].sort((a, b) => b.from - a.from);
          let tr = editor.state.tr;
          for (const entry of ordered) {
            if (entry.item.text === entry.item.original) continue;
            tr = tr.insertText(entry.item.text, entry.from, entry.to);
          }
          editor.view.dispatch(tr.scrollIntoView());
          return true;
        },
        focus() {
          editor?.chain().focus().run();
        },
      }),
      [editor],
    );

    function clear() {
      editor?.chain().focus().clearContent(true).run();
    }

    const words = countWords(text);
    const sentences = splitSentences(text).length;
    const overLimit = words > maxWords;
    const support = describeUploadSupport();

    return (
      <Card
        className={cn(
          "flex min-h-[26rem] flex-col overflow-hidden transition-shadow",
          dragging > 0 && "ring-2 ring-primary/45",
        )}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragEnter={(event) => {
          if (disabled || !event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragging((count) => count + 1);
        }}
        onDragLeave={() => setDragging((count) => Math.max(0, count - 1))}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(0);
          const files = Array.from(event.dataTransfer.files ?? []);
          if (files.length > 0) onFiles(files);
        }}
      >
        <EditorToolbar
          editor={editor}
          onPaste={onPaste}
          onUpload={onUpload}
          onImport={onImport}
          onClear={clear}
          disabled={disabled}
        />

        <div
          className="relative flex flex-1 flex-col"
          onMouseOver={(event) => {
            // Each layer reports its own absence, so a read-out cannot linger over
            // text it no longer describes.
            const match = matchElementAt(event.target);
            handlersRef.current.onMatchHover?.(
              match
                ? {
                    id: match.dataset.match ?? "",
                    rect: match.getBoundingClientRect(),
                  }
                : null,
            );
            const issue = issueElementAt(event.target);
            handlersRef.current.onIssueHover?.(
              issue
                ? {
                    id: issue.dataset.issue ?? "",
                    rect: issue.getBoundingClientRect(),
                  }
                : null,
            );
            const element = sentenceElementAt(event.target);
            handlersRef.current.onSentenceHover?.(
              element
                ? {
                    index: Number(element.dataset.sentence),
                    rect: element.getBoundingClientRect(),
                  }
                : null,
            );
          }}
          onMouseLeave={() => {
            handlersRef.current.onSentenceHover?.(null);
            handlersRef.current.onIssueHover?.(null);
            handlersRef.current.onMatchHover?.(null);
          }}
          onClick={(event) => {
            const match = matchElementAt(event.target);
            if (match) {
              handlersRef.current.onMatchSelect?.(match.dataset.match ?? null);
              return;
            }
            const issue = issueElementAt(event.target);
            if (issue) {
              handlersRef.current.onIssueSelect?.(issue.dataset.issue ?? null);
              return;
            }
            const element = sentenceElementAt(event.target);
            handlersRef.current.onSentenceSelect?.(
              element ? Number(element.dataset.sentence) : null,
            );
          }}
        >
          <EditorContent
            editor={editor}
            className="min-h-[18rem] flex-1 overflow-y-auto px-1 outline-none"
          />

          {text.length === 0 && !disabled ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 text-center">
              <p className="text-2xs text-muted-foreground">
                Drag a file here — {supportedTypesLabel(support)} · up to{" "}
                {formatBytes(support.maxBytes)}
              </p>
              <p className="pointer-events-auto">
                <Button type="button" variant="link" size="sm" onClick={onUpload}>
                  or Upload document
                </Button>
              </p>
            </div>
          ) : null}

          {dragging > 0 ? (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/95 text-center"
              aria-hidden="true"
            >
              <Upload className="size-6 text-primary" />
              <p className="text-sm font-medium">Drop the file to load its text</p>
              <p className="text-2xs text-muted-foreground">
                .txt and .md read in this browser.{" "}
                {support.serviceReady
                  ? ".docx and .pdf go through the document service."
                  : ".docx and .pdf need the document service, which is not attached."}
              </p>
            </div>
          ) : null}
        </div>

        <div
          id={`${ariaLabel}-metrics`}
          className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border bg-surface px-5 py-2 text-2xs text-muted-foreground tabular"
        >
          <span>{formatNumber(words)} words</span>
          <span>{formatNumber(countCharacters(text))} characters</span>
          <span>{formatNumber(sentences)} sentences</span>
          <span>{formatDuration(readingTimeSeconds(words))} read</span>
          {words > 0 && words < minWords ? (
            <span className="text-warning">
              {formatNumber(minWords - words)} more word{minWords - words === 1 ? "" : "s"} before
              this can be analysed
            </span>
          ) : null}
          {overLimit ? (
            <span className="text-error">
              {formatNumber(words - maxWords)} words over the {formatNumber(maxWords)} word limit
            </span>
          ) : null}
          {status ? <span className="ml-auto flex items-center gap-3">{status}</span> : null}
        </div>

        {savedAt ? <p className="sr-only">Draft saved locally at {savedAt}.</p> : null}
      </Card>
    );
  },
);

/** ".txt and .md, plus .docx and .pdf with a document service" in one line. */
function supportedTypesLabel(support: ReturnType<typeof describeUploadSupport>) {
  const plain = support.plain.map((extension) => `.${extension}`).join(", ");
  const converted = support.converted.map((extension) => `.${extension}`).join(", ");
  return `${plain} · ${converted}`;
}

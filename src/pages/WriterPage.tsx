import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Library, Save, Sparkles, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssistantColumn } from "@/components/assistant/AssistantPanel";
import { ImportDialog } from "@/components/detector/ImportDialog";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/editor/RichTextEditor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ACCEPT_ATTRIBUTE, extractTextFromFile } from "@/services/fileService";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { countWords, titleFromText } from "@/lib/text";
import { MAX_WORDS, formatNumber } from "@/lib/utils";
import { SAMPLE_DOCUMENTS } from "@/data/sampleDocuments";
import { getLibraryCapabilities, putDocument, putDocumentText } from "@/services/documentService";
import { getAssistantCapabilities } from "@/services/assistantService";
import { usePreferencesStore } from "@/store/preferencesStore";
import type { ServiceError, StoredDocument } from "@/types";

/**
 * The writing workspace: the document on the left, the assistant on the right. The
 * assistant is a component the detector also docks, so both surfaces report the same
 * capabilities rather than promising different things.
 */
export function WriterPage() {
  const capabilities = getAssistantCapabilities();
  const librarySource = getLibraryCapabilities();
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const language = usePreferencesStore((state) => state.language);
  const { toast } = useToast();
  const surface = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draftHtml] = useState(() => (storeDocuments ? readJson<string>(STORAGE_KEYS.writerHtml, "") : ""));
  const [content, setContent] = useState({ text: "", html: draftHtml });
  const lastSaved = useRef(draftHtml);
  const lastDocText = useRef<string | null>(null);
  const [openDoc, setOpenDoc] = useState<{ id: string; title: string } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<ServiceError | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const sampleIndex = useRef(0);

  const text = content.text;
  const words = countWords(text);

  useEffect(() => {
    if (!storeDocuments || content.html === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = content.html;
      writeJson(STORAGE_KEYS.writerHtml, content.html);
      setSavedAt(timeLabel());
    }, 700);
    return () => clearTimeout(timer);
  }, [content.html, storeDocuments]);

  function handleContentChange(nextText: string, nextHtml: string) {
    if (nextText.length === 0) setSource(null);
    setContent({ text: nextText, html: nextText.trim().length === 0 ? "" : nextHtml });
  }

  async function pasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setNotice("This browser does not let the page read your clipboard. Click in the editor and press Ctrl+V.");
      return;
    }
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim().length === 0) {
        setNotice("Your clipboard has no text in it.");
        return;
      }
      surface.current?.insertText(clip);
      setSource("pasted text");
      setNotice(null);
    } catch {
      setNotice("The browser blocked clipboard access. Click in the editor and paste manually instead.");
    }
  }

  async function loadFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (files.length > 1) setNotice(`Several files were dropped; only ${file.name} was loaded.`);
    const outcome = await extractTextFromFile(file);
    if (outcome.status === "error") {
      setFileError(outcome.error);
      return;
    }
    setFileError(null);
    surface.current?.loadText(outcome.file.text);
    setSource(outcome.file.filename);
    setNotice(null);
  }

  function loadExample() {
    const sample = SAMPLE_DOCUMENTS[sampleIndex.current % SAMPLE_DOCUMENTS.length];
    sampleIndex.current += 1;
    surface.current?.loadText(sample.text);
    setSource(`example: ${sample.title}`);
    setNotice(null);
    setFileError(null);
  }

  function importDocument(document: StoredDocument) {
    surface.current?.loadText(document.text);
    setOpenDoc({ id: document.id, title: document.title });
    lastDocText.current = document.text;
    setSource(`from library: ${document.title}`);
    setNotice(null);
  }

  /**
   * First save creates the library row, later ones write into it. An empty editor is
   * never stored over a document, the same rule the detector autosave follows.
   */
  function saveToLibrary() {
    if (text.trim().length === 0) {
      setNotice("There is nothing in the editor to save.");
      return;
    }
    void (async () => {
      try {
        if (openDoc) {
          const updated = await putDocumentText(openDoc.id, text);
          if (updated) {
            setOpenDoc({ id: updated.id, title: updated.title });
            lastDocText.current = text;
            toast({ title: `Saved to “${updated.title}”`, variant: "success" });
            return;
          }
        }
        const created = await putDocument({
          text,
          tool: "writer",
          language,
          title: openDoc?.title || titleFromText(text),
        });
        setOpenDoc({ id: created.id, title: created.title });
        lastDocText.current = text;
        toast({
          title: storeDocuments || librarySource.backendConfigured ? "Added to your library" : "Kept for this session only",
          description:
            librarySource.backendConfigured
              ? `“${created.title}” is stored on the library service with the text as it stands.`
              : storeDocuments
                ? `“${created.title}” is stored on this device with the text as it stands.`
                : "Local saving is off in Preferences, so this row disappears when the tab closes.",
          variant: storeDocuments || librarySource.backendConfigured ? "success" : "warning",
        });
      } catch (error) {
        toast({
          title: "Nothing was saved",
          description:
            error instanceof Error ? error.message : "The library would not take the document.",
          variant: "error",
        });
      }
    })();
  }

  return (
    <>
      <PageHeader
        title="AI Writing Assistant"
        description="Work on a draft and ask the assistant to reshape the part you select."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Assistant" }]}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={loadExample}>
              <Sparkles className="size-3.5" aria-hidden />
              Example
            </Button>
            <Button asChild variant="subtle" size="sm">
              <Link to="/documents">
                <Library className="size-3.5" aria-hidden />
                <span className="sr-only sm:not-sr-only">Library</span>
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          {fileError ? (
            <div className="flex items-start gap-3 rounded-lg border border-error/30 bg-error-soft px-4 py-3">
              <Upload className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
              <p className="min-w-0 flex-1 text-2xs leading-relaxed text-error">{fileError.message}</p>
              <button
                type="button"
                onClick={() => setFileError(null)}
                aria-label="Dismiss file message"
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="flex items-start gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-2.5 text-2xs leading-relaxed text-muted-foreground"
            >
              <span className="min-w-0 flex-1">{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss message"
                className="rounded p-0.5 transition-colors hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </p>
          ) : null}

          <RichTextEditor
            ref={surface}
            initialHtml={draftHtml}
            onChange={handleContentChange}
            onPaste={() => void pasteFromClipboard()}
            onUpload={() => fileInputRef.current?.click()}
            onImport={() => setImportOpen(true)}
            onFiles={(files) => void loadFiles(files)}
            minWords={1}
            maxWords={MAX_WORDS}
            ariaLabel="Document to work on"
            savedAt={savedAt}
            placeholder="Start writing, paste a draft, or drop a file. Select a passage to limit the assistant to it."
            status={
              <>
                {source ? (
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-3" aria-hidden />
                    {source}
                  </span>
                ) : null}
                {words > MAX_WORDS ? (
                  <span className="text-warning">{formatNumber(words - MAX_WORDS)} words over the limit</span>
                ) : openDoc ? (
                  <span>In “{openDoc.title}”</span>
                ) : null}
              </>
            }
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length > 0) void loadFiles(files);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={saveToLibrary} disabled={words === 0}>
              <Save className="size-3.5" aria-hidden />
              {openDoc ? "Save in library" : "Save to library"}
            </Button>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {capabilities.engine === "backend"
                ? "Requests go to the connected writing service."
                : "Six actions run from the tools built into this build; the two that would generate new prose are switched off until a model is connected."}
            </p>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <AssistantColumn
            documentText={text}
            language={language}
            getSelection={() => surface.current?.getSelectionText() ?? ""}
            onInsert={(value) => surface.current?.insertText(value)}
          />
        </div>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onPick={importDocument} />
    </>
  );
}

function timeLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

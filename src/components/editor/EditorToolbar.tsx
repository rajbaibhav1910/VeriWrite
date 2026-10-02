import { useState, type ElementType, type FormEvent } from "react";
import { useEditorState } from "@tiptap/react";
import {
  ClipboardPaste,
  Eraser,
  FolderOpen,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Upload,
  Underline as UnderlineIcon,
  Code,
  Type,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface EditorToolbarProps {
  editor: Editor | null;
  onPaste(): void;
  onUpload(): void;
  onImport(): void;
  onClear(): void;
  disabled?: boolean;
}

const IDLE = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  paragraph: false,
  heading2: false,
  heading3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  link: false,
  isEmpty: true,
  canUndo: false,
  canRedo: false,
};

/**
 * Formatting and document actions for the rich-text surface. Button state is read
 * from the editor itself through `useEditorState`, so a mark button shows what is
 * actually applied rather than what was last clicked.
 */
export function EditorToolbar({
  editor,
  onPaste,
  onUpload,
  onImport,
  onClear,
  disabled = false,
}: EditorToolbarProps) {
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      if (!instance) return IDLE;
      return {
        bold: instance.isActive("bold"),
        italic: instance.isActive("italic"),
        underline: instance.isActive("underline"),
        strike: instance.isActive("strike"),
        code: instance.isActive("code"),
        paragraph: instance.isActive("paragraph"),
        heading2: instance.isActive("heading", { level: 2 }),
        heading3: instance.isActive("heading", { level: 3 }),
        bulletList: instance.isActive("bulletList"),
        orderedList: instance.isActive("orderedList"),
        blockquote: instance.isActive("blockquote"),
        link: instance.isActive("link"),
        isEmpty: instance.isEmpty,
        canUndo: instance.can().undo(),
        canRedo: instance.can().redo(),
      };
    },
  });
  const state = snapshot ?? IDLE;

  function toggleLink() {
    if (!editor) return;
    if (state.link) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkDraft(null);
      return;
    }
    setLinkDraft("");
  }

  function applyLink(event: FormEvent) {
    event.preventDefault();
    if (!editor || linkDraft === null) return;
    const href = linkDraft.trim();
    if (href.length === 0) {
      editor.chain().focus().unsetLink().run();
      setLinkDraft(null);
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    // With no selection there is nothing to mark, so the address becomes the label.
    if (editor.state.selection.empty) {
      chain
        .insertContent({
          type: "text",
          text: href,
          marks: [{ type: "link", attrs: { href, target: "_blank" } }],
        })
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkDraft(null);
  }

  return (
    <div className="border-b border-border bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
        <ToolButton
          icon={Type}
          label="Bold"
          hint="Ctrl+B"
          active={state.bold}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolButton
          icon={Italic}
          label="Italic"
          hint="Ctrl+I"
          active={state.italic}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolButton
          icon={UnderlineIcon}
          label="Underline"
          hint="Ctrl+U"
          active={state.underline}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolButton
          icon={Strikethrough}
          label="Strikethrough"
          active={state.strike}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolButton
          icon={Code}
          label="Inline code"
          active={state.code}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        />

        <Separator />

        <ToolButton
          icon={Pilcrow}
          label="Body text"
          active={state.paragraph}
          disabled={disabled}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        />
        <ToolButton
          icon={Heading2}
          label="Heading"
          active={state.heading2}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolButton
          icon={Heading3}
          label="Subheading"
          active={state.heading3}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />

        <Separator />

        <ToolButton
          icon={List}
          label="Bulleted list"
          active={state.bulletList}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          icon={ListOrdered}
          label="Numbered list"
          active={state.orderedList}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          icon={Quote}
          label="Quote"
          active={state.blockquote}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          icon={state.link ? Link2Off : Link2}
          label={state.link ? "Remove link" : "Add link"}
          active={state.link}
          disabled={disabled}
          onClick={toggleLink}
        />
      </div>

      {linkDraft !== null ? (
        <form
          onSubmit={applyLink}
          className="flex items-center gap-1.5 border-t border-border px-2 py-1.5"
        >
          <label className="sr-only" htmlFor="editor-link-url">
            Link address
          </label>
          <Input
            id="editor-link-url"
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            placeholder="https://example.com/page"
            autoComplete="off"
            spellCheck={false}
            className="h-8 flex-1 text-2xs"
          />
          <Button type="submit" size="sm" className="h-8 text-2xs">
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-2xs"
            onClick={() => setLinkDraft(null)}
          >
            Cancel
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-0.5 border-t border-border px-2 py-1.5">
        <ToolButton
          icon={ClipboardPaste}
          label="Paste"
          disabled={disabled}
          onClick={onPaste}
        />
        <ToolButton
          icon={Upload}
          label="Upload"
          disabled={disabled}
          onClick={onUpload}
        />
        <ToolButton
          icon={FolderOpen}
          label="Import"
          disabled={disabled}
          onClick={onImport}
        />
        <ToolButton
          icon={Eraser}
          label="Clear"
          disabled={disabled || state.isEmpty}
          onClick={onClear}
        />

        <Separator />

        <ToolButton
          icon={Undo2}
          label="Undo"
          hint="Ctrl+Z"
          disabled={disabled || !state.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <ToolButton
          icon={Redo2}
          label="Redo"
          hint="Ctrl+Shift+Z"
          disabled={disabled || !state.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        />
      </div>
    </div>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function ToolButton({
  icon: Icon,
  label,
  hint,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: ElementType;
  label: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      // Without this the button takes focus on mousedown, the selection collapses to
      // nothing and the mark would be applied to the caret instead of the words.
      onMouseDown={(event) => event.preventDefault()}
      disabled={disabled}
      aria-pressed={active}
      title={hint ? `${label} (${hint})` : label}
      className={cn(
        "size-7 rounded-md text-muted-foreground transition-colors",
        active && "bg-accent text-accent-foreground hover:bg-accent",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const MAX_TITLE = 120;

interface RenameDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** What is being renamed, used for the heading and the screen-reader label. */
  subject: string;
  initialValue: string;
  hint?: string;
  onSubmit(name: string): void;
}

/** One rename flow for documents and analysis rows: trim, refuse empty, cap length. */
export function RenameDialog({
  open,
  onOpenChange,
  subject,
  initialValue,
  hint,
  onSubmit,
}: RenameDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const trimmed = value.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MAX_TITLE;

  function commit() {
    if (!valid) return;
    onSubmit(trimmed);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Rename {subject}</DialogTitle>
          <DialogDescription>
            {hint ?? "Only the name changes. The text and any measurements stay as they are."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="p-5 pb-0">
          <form id="rename-form" onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}>
            <Label htmlFor="rename-field" className="text-2xs uppercase tracking-wider">
              Name
            </Label>
            <Input
              id="rename-field"
              className="mt-1.5"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={MAX_TITLE + 20}
              autoComplete="off"
              aria-invalid={value.length > 0 && !valid ? true : undefined}
            />
            <p className="mt-1.5 text-2xs text-muted-foreground">
              {trimmed.length === 0
                ? "A name is needed."
                : trimmed.length > MAX_TITLE
                  ? `Keep it under ${MAX_TITLE} characters.`
                  : `${trimmed.length} of ${MAX_TITLE} characters used.`}
            </p>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="rename-form" disabled={!valid}>
            Save name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

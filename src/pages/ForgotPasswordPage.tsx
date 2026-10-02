import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CircleCheck, Info, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthCapabilities, isValidEmail, requestPasswordReset } from "@/services/authService";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const capabilities = getAuthCapabilities();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    try {
      const outcome = await requestPasswordReset(email);
      setSent(outcome.status === "sent" ? outcome.message : null);
      if (outcome.status === "error") setError(`${outcome.message} ${outcome.hint ?? ""}`.trim());
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-border/70 p-6 shadow-raised">
      <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        Enter the address on your account and we will send a link that expires after an hour.
      </p>

      {sent ? (
        <div
          className="mt-5 flex gap-2.5 rounded-md border border-success/25 bg-success-soft p-3.5 text-xs leading-relaxed text-success"
          role="status"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{sent}</span>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">Email</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                className="pl-9"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "reset-email-error" : undefined}
                placeholder="you@studio.com"
              />
            </div>
            {error && (
              <p id="reset-email-error" className="text-2xs text-error">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" size="md" className="w-full" loading={pending}>
            Send reset link
          </Button>
        </form>
      )}

      {!capabilities.passwordReset && (
        <p className="mt-4 flex gap-2 text-2xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          No auth service is attached to this copy of VeriWrite, so there is no account to reset and
          no mail to send. Demo sessions live only in this browser.
        </p>
      )}

      <p className="mt-5 border-t border-border pt-4 text-center text-2xs text-muted-foreground">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

export type ScoreTone = "ai" | "human" | "mixed" | "neutral";

interface ScoreRingProps {
  /** 0-100 estimate; the ring never renders as a verdict. */
  value: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  /** Sub-label under the number, e.g. "Estimated likelihood of AI involvement". */
  sublabel?: string;
  tone?: ScoreTone;
  /** Animates the arc on mount and whenever the value changes. */
  animated?: boolean;
  suffix?: string;
  className?: string;
}

const TONE_VAR: Record<ScoreTone, string> = {
  ai: "var(--signal-ai)",
  human: "var(--signal-human)",
  mixed: "var(--signal-mixed)",
  neutral: "var(--signal-neutral)",
};

export function toneForProbability(value: number): ScoreTone {
  if (value >= 65) return "ai";
  if (value <= 35) return "human";
  return "mixed";
}

export function ScoreRing({
  value,
  size = 168,
  strokeWidth = 10,
  label,
  sublabel,
  tone = toneForProbability(value),
  animated = true,
  suffix = "%",
  className,
}: ScoreRingProps) {
  const gradientId = useId();
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [progress, setProgress] = useState(animated ? 0 : clamped);

  useEffect(() => {
    if (!animated) {
      setProgress(clamped);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = progress;
    const duration = 620;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic keeps the settle quick rather than springy
      const eased = 1 - (1 - t) ** 3;
      setProgress(from + (clamped - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `progress` is the animation's start point on purpose: restarting mid-flight would snap.
  }, [clamped, animated]);

  const offset = circumference - (progress / 100) * circumference;
  const color = TONE_VAR[tone];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(clamped)}${suffix}. ${sublabel ?? ""}`.trim()}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <span
          className="font-semibold leading-none tracking-tight tabular"
          style={{ fontSize: size * 0.24, color }}
        >
          {/* The figure is the measurement, so it never waits on an animation frame. */}
          {Math.round(clamped)}
          <span className="text-[0.55em] font-medium opacity-80">{suffix}</span>
        </span>
        <span className="mt-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.07em] text-muted-foreground">
          {label}
        </span>
        {sublabel && (
          <span className="mt-1 text-[0.625rem] leading-tight text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

import * as React from "react";
import { CircleCheck, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn, uid } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms; pass Infinity to pin the toast. */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "title" | "variant" | "duration">> {
  id: string;
  description?: React.ReactNode;
  leaving: boolean;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const DEFAULT_DURATION = 5_000;
const EXIT_MS = 180;

const ToastContext = React.createContext<ToastContextValue | null>(null);

type Action =
  | { type: "add"; item: ToastItem }
  | { type: "leave"; id: string }
  | { type: "remove"; id: string };

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case "add":
      return [...state, action.item];
    case "leave":
      return state.map((item) => (item.id === action.id ? { ...item, leaving: true } : item));
    case "remove":
      return state.filter((item) => item.id !== action.id);
    default:
      return state;
  }
}

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  default: <Info aria-hidden />,
  success: <CircleCheck aria-hidden />,
  error: <XCircle aria-hidden />,
  warning: <TriangleAlert aria-hidden />,
  info: <Info aria-hidden />,
};

const variantTint: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  error: "text-error",
  warning: "text-warning",
  info: "text-info",
};

const ToastViewport = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function ToastViewport({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        aria-live="polite"
        aria-atomic="false"
        className={cn(
          "pointer-events-none fixed right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4",
          className,
        )}
        {...props}
      />
    );
  },
);
ToastViewport.displayName = "ToastViewport";

export function ToastProvider({
  children,
  max = 4,
}: {
  children: React.ReactNode;
  max?: number;
}) {
  const [items, dispatch] = React.useReducer(reducer, [] as ToastItem[]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const dismiss = React.useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    dispatch({ type: "leave", id });
    const exit = setTimeout(() => {
      dispatch({ type: "remove", id });
      timers.current.delete(id);
    }, EXIT_MS);
    timers.current.set(id, exit);
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = uid("toast");
      const duration = options.duration ?? DEFAULT_DURATION;
      dispatch({
        type: "add",
        item: {
          id,
          title: options.title ?? "",
          description: options.description,
          variant: options.variant ?? "default",
          duration,
          leaving: false,
        },
      });
      if (Number.isFinite(duration)) {
        timers.current.set(id, setTimeout(() => dispatch({ type: "leave", id }), duration));
      }
      return id;
    },
    [],
  );

  const value = React.useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);
  const visible = items.length > max ? items.slice(items.length - max) : items;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport>
        {visible.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border border-border bg-popover p-3.5 text-popover-foreground shadow-overlay transition-all duration-150 animate-slide-up",
              item.leaving && "translate-y-1 opacity-0",
            )}
          >
            <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", variantTint[item.variant])}>
              {variantIcon[item.variant]}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {item.title ? <p className="text-sm font-medium leading-snug">{item.title}</p> : null}
              {item.description ? (
                <p className="text-2xs leading-relaxed text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </ToastViewport>
    </ToastContext.Provider>
  );
}
ToastProvider.displayName = "ToastProvider";

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

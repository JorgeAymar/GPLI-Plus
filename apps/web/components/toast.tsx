"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type ToastVariant = "success" | "error";

interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

/**
 * App-wide toast notifications. Mount ONE `<ToastProvider>` per route group
 * (see `(central)/layout.tsx`) and call `useToast().showToast(...)` from any
 * client component underneath it - typically via `useFormSuccessToast` below.
 *
 * Accessibility: the toast region is a real `role="status"`/`aria-live="polite"`
 * live region (announced by screen readers without needing focus), AND it is
 * focused imperatively when a new toast appears so sighted keyboard users
 * don't lose their place either. This is what makes it double as the fix for
 * "focus drops to <body> after submit" - see `useFormSuccessToast`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const latestId = toasts.length > 0 ? toasts[toasts.length - 1]!.id : null;

  // Move focus to the live region whenever a *new* toast is pushed (but not
  // when the list merely shrinks from a dismissal), so the keyboard/screen
  // reader user's focus lands somewhere meaningful instead of <body>.
  useEffect(() => {
    if (latestId !== null) {
      containerRef.current?.focus();
    }
  }, [latestId]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        ref={containerRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 outline-none sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-md px-4 py-3 text-sm font-medium shadow-lg ${
              t.variant === "error" ? "bg-red-600 text-white" : "bg-foreground text-background"
            }`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-xs underline opacity-80 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              Cerrar
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de un <ToastProvider>");
  }
  return ctx;
}

/**
 * Standard "success feedback" wiring for `useActionState`-based create forms.
 *
 * The pattern every create-form action already follows is:
 *   `async (_prev, formData) => { try { await createXAction(...); return {}; }
 *    catch (err) { return { error: ... }; } }`
 *
 * Drop this hook in right after `useActionState` and it will, on every
 * successful submit (state present and `state.error` falsy - but NOT on
 * initial mount, where state is `undefined`):
 *   1. show a toast with `message` (announced via the live region above), and
 *   2. reset the uncontrolled form fields via `formRef`.
 * Focus lands on the toast automatically (see `ToastProvider`), fixing the
 * "focus lost to <body>" accessibility gap for the same event.
 *
 * To replicate on another create form:
 *   const formRef = useRef<HTMLFormElement>(null);
 *   const [state, formAction, isPending] = useActionState(makeAction(...), undefined);
 *   useFormSuccessToast(state, formRef, "X creado.");
 *   // ...and add `ref={formRef}` to the <form>.
 */
export function useFormSuccessToast(
  state: { error?: string } | undefined,
  formRef: RefObject<HTMLFormElement | null>,
  message: string,
) {
  const { showToast } = useToast();

  useEffect(() => {
    if (state && !state.error) {
      showToast(message);
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire only when `state` transitions (new object per submit); formRef/showToast/message are stable for the component's lifetime.
  }, [state]);
}

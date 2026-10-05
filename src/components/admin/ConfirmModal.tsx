import { useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmState = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  resolve?: (value: boolean) => void;
};

let globalConfirm:
  | ((opts: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      isDanger?: boolean;
    }) => Promise<boolean>)
  | null = null;

export function showConfirm(opts: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}) {
  if (globalConfirm) return globalConfirm(opts);
  return Promise.resolve(window.confirm(opts.message));
}

export function ConfirmModalProvider() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
  });

  const confirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      isDanger?: boolean;
    }) => {
      return new Promise<boolean>((resolve) => {
        setState({
          isOpen: true,
          title: opts.title,
          message: opts.message,
          confirmText: opts.confirmText ?? "تأكيد",
          cancelText: opts.cancelText ?? "إلغاء",
          isDanger: opts.isDanger ?? false,
          resolve,
        });
      });
    },
    [],
  );

  globalConfirm = confirm;

  const handleClose = (value: boolean) => {
    state.resolve?.(value);
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  if (!state.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${state.isDanger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{state.title}</h3>
          </div>
          <button
            onClick={() => handleClose(false)}
            className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{state.message}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => handleClose(false)}
            className="rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground hover:bg-secondary transition-colors"
          >
            {state.cancelText}
          </button>
          <button
            onClick={() => handleClose(true)}
            className={`rounded-2xl px-5 py-2.5 text-xs font-bold text-white transition-colors shadow-sm ${
              state.isDanger
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

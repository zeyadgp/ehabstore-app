import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  isDestructive = true,
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) return;
    await onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !isLoading && onOpenChange(v)}>
      <AlertDialogContent
        className="max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft"
        dir="rtl"
      >
        <AlertDialogHeader className="space-y-2 text-right">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                isDestructive
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="font-display text-base font-extrabold text-foreground">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground pt-1">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-5 flex-row-reverse items-center justify-start gap-2 border-t border-border/50 pt-4 sm:justify-start">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-5 py-2.5 text-xs font-extrabold text-white shadow-soft transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cx, IconButton } from "./ui";

/**
 * Phone: bottom sheet. Desktop: `panel` docks on the right (map stays usable), `modal` centres.
 */
export function Sheet({
  open,
  onClose,
  title,
  variant = "modal",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  variant?: "modal" | "panel";
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const panel = variant === "panel";

  return (
    <div className={cx("fixed inset-0 z-[1000]", panel && "pointer-events-none")}>
      {!panel && <div className="animate-fade absolute inset-0 bg-ink/30" onClick={onClose} />}
      <div
        role="dialog"
        aria-modal={!panel}
        className={cx(
          "animate-sheet pointer-events-auto absolute flex flex-col bg-white shadow-2xl",
          "inset-x-0 bottom-0 rounded-t-3xl",
          panel ? "max-h-[55dvh]" : "max-h-[92dvh]",
          panel
            ? "md:inset-y-3 md:right-3 md:bottom-3 md:left-auto md:max-h-none md:w-[35%] md:min-w-[360px] md:max-w-[460px] md:rounded-2xl"
            : "md:inset-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line md:hidden" />
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2">
            <div className="text-lg font-bold">{title}</div>
            <IconButton label="Close" onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

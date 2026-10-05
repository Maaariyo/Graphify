"use client";

import { Star } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CATEGORY_BY_ID, STATUS_BY_ID } from "@/lib/categories";
import type { CategoryId, Member, Status } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function CategoryIcon({ id, size = "md" }: { id: CategoryId; size?: "sm" | "md" | "lg" }) {
  const c = CATEGORY_BY_ID[id];
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  const icon = size === "sm" ? 15 : size === "lg" ? 24 : 19;
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center", box)}
      style={{ background: `${c.color}17`, color: c.color }}
      aria-label={c.label}
    >
      <c.Icon size={icon} strokeWidth={2.2} />
    </span>
  );
}

export function StatusDot({ status, className }: { status: Status | null | undefined; className?: string }) {
  if (!status) return <span className={cx("inline-block h-2.5 w-2.5 rounded-full border border-line", className)} />;
  return (
    <span
      title={STATUS_BY_ID[status].label}
      className={cx("inline-block h-2.5 w-2.5 rounded-full", className)}
      style={{ background: STATUS_BY_ID[status].color }}
    />
  );
}

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS_BY_ID[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `${s.color}14`, color: s.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

const AVATAR_COLORS = ["#E8590C", "#1C7ED6", "#2B8A3E", "#7048E8", "#C2255C", "#0C8599", "#E67700", "#5C940D"];

export function Avatar({ member, size = 28 }: { member: Pick<Member, "id" | "name"> | null; size?: number }) {
  const name = member?.name ?? "?";
  let h = 0;
  for (const ch of member?.id ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: member ? AVATAR_COLORS[h % AVATAR_COLORS.length] : "#adb5bd" }}
      title={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Chip({
  active,
  children,
  color,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/30",
        className,
      )}
      style={active && color ? { background: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  const styles = {
    primary: "bg-ink text-white hover:bg-ink/90 disabled:bg-ink/40",
    secondary: "border border-line bg-white text-ink hover:border-ink/30 disabled:text-muted",
    ghost: "text-ink hover:bg-ink/5",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
    styles,
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button type="button" {...rest} className={buttonClass(variant, className)}>
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx("inline-grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-ink/5", className)}
    >
      {children}
    </button>
  );
}

export function Stars({ value, onChange, size = 18 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value != null && n <= Math.round(value);
        const star = <Star size={size} className={filled ? "fill-amber-400 text-amber-400" : "text-line"} strokeWidth={2} />;
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="p-0.5"
            onClick={() => onChange(value === n ? null : n)}
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{children}</div>;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white text-muted shadow-sm">{icon}</div>
      <div className="text-base font-bold">{title}</div>
      <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

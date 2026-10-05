import { cx } from "./ui";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#1f2328" />
        <path d="M16 6.5c-4.1 0-7.5 3.2-7.5 7.3 0 5.3 7.5 11.7 7.5 11.7s7.5-6.4 7.5-11.7c0-4.1-3.4-7.3-7.5-7.3z" fill="#fff" />
        <circle cx="16" cy="13.8" r="3" fill="#0c8599" />
      </svg>
      Wanderlist
    </span>
  );
}

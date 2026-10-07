"use client";

import { CalendarDays, List, LoaderCircle, Map, Plus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { LoginScreen, NotInvitedScreen } from "./LoginScreen";
import { Logo } from "./Logo";
import { PlaceDetailSheet } from "./PlaceDetail";
import { PlaceFormSheet } from "./PlaceForm";
import { Avatar, cx } from "./ui";

const NAV = [
  { href: "/", label: "Map", Icon: Map },
  { href: "/places", label: "Places", Icon: List },
  { href: "/plan", label: "Plan", Icon: CalendarDays },
  { href: "/friends", label: "Friends", Icon: Users },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { auth, data, loadError, me, setEditor, toasts, repo, refresh } = useStore();
  const pathname = usePathname();

  // The invite page must work before anyone is signed in.
  if (pathname === "/join") return <>{children}</>;
  if (!auth) return <FullScreenLoader />;
  if (auth.kind === "signed-out") return <LoginScreen />;
  if (auth.kind === "not-invited") return <NotInvitedScreen email={auth.email} />;
  if (!data) {
    return loadError ? (
      <div className="grid h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-bold">Couldn&apos;t load your places</p>
          <p className="mt-1 text-sm text-muted">{loadError}</p>
          <button className="mt-4 font-semibold text-accent underline" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      </div>
    ) : (
      <FullScreenLoader />
    );
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-4 md:flex">
        <Link href="/" className="px-2 pb-6">
          <Logo className="text-lg" />
        </Link>
        <button
          type="button"
          onClick={() => setEditor({ mode: "add" })}
          className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm font-bold text-white hover:bg-ink/90"
        >
          <Plus size={18} /> Add place
        </button>
        <nav className="space-y-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                isActive(href) ? "bg-paper text-ink" : "text-muted hover:bg-paper/60 hover:text-ink",
              )}
            >
              <Icon size={19} /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          {repo.mode === "demo" && (
            <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <b>Demo mode.</b> Data is saved in this browser only.
            </div>
          )}
          <Link href="/friends" className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-paper">
            <Avatar member={me} size={30} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{me?.name}</div>
              <div className="truncate text-xs text-muted">{me?.role === "admin" ? "Admin" : "Member"}</div>
            </div>
          </Link>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-[900] flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold",
              isActive(href) ? "text-ink" : "text-muted",
            )}
          >
            <Icon size={22} strokeWidth={isActive(href) ? 2.4 : 2} />
            {label}
          </Link>
        ))}
      </nav>

      <PlaceDetailSheet />
      <PlaceFormSheet />

      <div className="pointer-events-none fixed inset-x-0 top-3 z-[1100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              "animate-sheet pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg",
              t.tone === "error" ? "bg-red-700 text-white" : "bg-ink text-white",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Floating + button. Pages place it; it sits above the phone nav bar. */
export function AddFab({ className }: { className?: string }) {
  const { setEditor } = useStore();
  return (
    <button
      type="button"
      aria-label="Add a place"
      onClick={() => setEditor({ mode: "add" })}
      className={cx(
        "grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white shadow-xl shadow-ink/25 transition-transform active:scale-95",
        className,
      )}
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  );
}

function FullScreenLoader() {
  return (
    <div className="grid h-dvh place-items-center">
      <LoaderCircle className="animate-spin text-muted" />
    </div>
  );
}

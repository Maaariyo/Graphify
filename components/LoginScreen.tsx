"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { resetDemoData } from "@/lib/repo/local";
import { useStore } from "@/lib/store";
import type { Member } from "@/lib/types";
import { Logo } from "./Logo";
import { Avatar, Button } from "./ui";

export function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Logo className="text-2xl" />
        <p className="mt-2 mb-8 text-muted">Our group&apos;s map of places to explore.</p>
        {children}
      </div>
    </div>
  );
}

export function LoginScreen() {
  const { repo } = useStore();
  return <Frame>{repo.mode === "demo" ? <DemoLogin /> : <PasswordLogin />}</Frame>;
}

function DemoLogin() {
  const { repo } = useStore();
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    void repo.load().then((s) => setMembers(s.members));
  }, [repo]);
  return (
    <div>
      <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <b>Demo mode.</b> No database is connected, so sample data lives in this browser. See the README to connect
        Supabase.
      </div>
      <div className="mb-2 text-sm font-bold">Continue as</div>
      <div className="space-y-2">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => repo.signIn(m.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-left hover:border-ink/30"
          >
            <Avatar member={m} size={32} />
            <span className="font-semibold">{m.name}</span>
            {m.role === "admin" && <span className="ml-auto text-xs font-semibold text-muted">Admin</span>}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="mt-6 text-xs font-semibold text-muted underline"
        onClick={() => {
          resetDemoData();
          window.location.reload();
        }}
      >
        Reset demo data
      </button>
    </div>
  );
}

function PasswordLogin() {
  const { repo } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          await repo.signIn(email, password);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not sign in");
          setBusy(false);
        }
      }}
    >
      <label className="mb-2 block text-sm font-bold" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@gmail.com"
        className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-ink"
      />
      <label className="mt-4 mb-2 block text-sm font-bold" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-ink"
      />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="mt-4 w-full py-3" disabled={busy}>
        {busy && <LoaderCircle size={16} className="animate-spin" />}
        Sign in
      </Button>
      <p className="mt-4 text-xs text-muted">
        New here, or forgot your password? Ask the group admin to send you a join link on WhatsApp.
      </p>
    </form>
  );
}

export function NotInvitedScreen({ email }: { email: string }) {
  const { repo } = useStore();
  return (
    <Frame>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="font-bold">You&apos;re not on the list yet</div>
        <p className="mt-1 text-sm text-muted">
          <b className="text-ink">{email}</b> hasn&apos;t been invited. Ask the group admin to add this exact email, then
          reload.
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="secondary" onClick={() => repo.signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </Frame>
  );
}

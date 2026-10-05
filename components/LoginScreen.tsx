"use client";

import { LoaderCircle, Mail } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { resetDemoData } from "@/lib/repo/local";
import { useStore } from "@/lib/store";
import type { Member } from "@/lib/types";
import { Logo } from "./Logo";
import { Avatar, Button } from "./ui";

function Frame({ children }: { children: ReactNode }) {
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
  return <Frame>{repo.mode === "demo" ? <DemoLogin /> : <EmailLogin />}</Frame>;
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

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true";

function EmailLogin() {
  const { repo } = useStore();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);
  const fail = (err: unknown, fallback: string) => setError(err instanceof Error ? err.message : fallback);

  if (state === "sent" || state === "verifying") {
    return (
      <form
        className="rounded-2xl bg-white p-5 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setState("verifying");
          try {
            await repo.verifyCode?.(email, code);
          } catch (err) {
            fail(err, "That code didn't work");
            setState("sent");
          }
        }}
      >
        <Mail className="mb-2 text-accent" />
        <div className="font-bold">Check your email</div>
        <p className="mt-1 text-sm text-muted">
          We sent a code to <b className="text-ink">{email}</b>. Type it here, or tap the link in the email.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Code"
          aria-label="Sign-in code"
          className="mt-4 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-center text-xl font-bold tracking-[0.3em] outline-none focus:border-ink"
        />
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="mt-3 w-full py-3" disabled={code.length < 6 || state === "verifying"}>
          {state === "verifying" && <LoaderCircle size={16} className="animate-spin" />}
          Sign in
        </Button>
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-accent underline"
          onClick={() => {
            setState("idle");
            setCode("");
            setError(null);
          }}
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <div>
      {GOOGLE_ENABLED && repo.signInWithGoogle && (
        <>
          <Button
            variant="secondary"
            className="w-full py-3"
            onClick={() => repo.signInWithGoogle!().catch((err) => fail(err, "Google sign-in failed"))}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
              <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
            </svg>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setState("sending");
          try {
            await repo.signIn(email);
            setState("sent");
          } catch (err) {
            fail(err, "Could not send the email");
            setState("idle");
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
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="mt-3 w-full py-3" disabled={state === "sending"}>
          {state === "sending" && <LoaderCircle size={16} className="animate-spin" />}
          Email me a sign-in code
        </Button>
        <p className="mt-4 text-xs text-muted">Invite only. Ask the group admin to add your email first.</p>
      </form>
    </div>
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

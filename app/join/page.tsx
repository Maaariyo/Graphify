"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Frame } from "@/components/LoginScreen";
import { Button } from "@/components/ui";
import { useStore } from "@/lib/store";

type Invite = { email: string; existing: boolean; name: string | null };

/** Landing page for a WhatsApp invite link: /join#<token>. The token stays in the #, so it never hits server logs. */
export default function JoinPage() {
  const { repo } = useStore();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // Re-read on hashchange too: tapping a second link while this page is open only changes the #.
    const read = () => {
      const t = window.location.hash.slice(1);
      setToken(t);
      setInvite(null);
      setError(null);
      if (!repo.checkInvite) {
        setError("Invite links only work once the app is connected to Supabase. In demo mode, just pick a person.");
        return;
      }
      if (!t) {
        setError("This link is missing its code. Ask the admin to send it again.");
        return;
      }
      repo
        .checkInvite(t)
        .then((inv) => {
          setInvite(inv);
          setName(inv.name ?? "");
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "This link didn't work"));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [repo]);

  return (
    <Frame>
      {error ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="font-bold">Can&apos;t use this link</div>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.replace("/")}>
            Go to sign in
          </Button>
        </div>
      ) : !invite ? (
        <LoaderCircle className="animate-spin text-muted" />
      ) : (
        <form
          className="rounded-2xl bg-white p-5 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!token || !repo.join) return;
            setSubmitError(null);
            setBusy(true);
            try {
              await repo.join(token, password, name);
              router.replace("/");
            } catch (err) {
              setBusy(false);
              setSubmitError(err instanceof Error ? err.message : "Could not join");
            }
          }}
        >
          <div className="font-bold">{invite.existing ? "Set a new password" : "You're invited"}</div>
          <p className="mt-1 text-sm text-muted">
            {invite.existing ? "For" : "Joining as"} <b className="text-ink">{invite.email}</b>
          </p>
          {!invite.existing && (
            <>
              <label className="mt-4 mb-2 block text-sm font-bold" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What friends call you"
                className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-ink"
              />
            </>
          )}
          <label className="mt-4 mb-2 block text-sm font-bold" htmlFor="new-password">
            Choose a password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-ink"
          />
          {submitError && <p className="mt-2 text-sm text-red-700">{submitError}</p>}
          <Button type="submit" className="mt-4 w-full py-3" disabled={busy || password.length < 8}>
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            {invite.existing ? "Save and sign in" : "Join Wanderlist"}
          </Button>
          <p className="mt-4 text-xs text-muted">
            On iPhone: after joining, tap Share → Add to Home Screen, then sign in there once with this email and
            password.
          </p>
        </form>
      )}
    </Frame>
  );
}

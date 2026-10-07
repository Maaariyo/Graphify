"use client";

import { Copy, KeyRound, LogOut, MessageCircle, ShieldCheck, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Button, buttonClass, CategoryIcon, cx, IconButton, SectionLabel } from "@/components/ui";
import { CATEGORIES, STATUSES } from "@/lib/categories";
import { useStore } from "@/lib/store";
import type { Member, Role } from "@/lib/types";

export default function FriendsPage() {
  const { data, views, me, repo, isAdmin, select } = useStore();
  const [openId, setOpenId] = useState<string | null>(me?.id ?? null);

  const stats = useMemo(() => {
    const out = new Map<string, { added: number; byCat: Map<string, number>; byStatus: Map<string, number> }>();
    for (const m of data?.members ?? []) out.set(m.id, { added: 0, byCat: new Map(), byStatus: new Map() });
    for (const v of views) {
      const s = v.created_by ? out.get(v.created_by) : undefined;
      if (s) {
        s.added++;
        s.byCat.set(v.category, (s.byCat.get(v.category) ?? 0) + 1);
      }
    }
    for (const st of data?.statuses ?? []) {
      const s = out.get(st.user_id);
      if (s) s.byStatus.set(st.status, (s.byStatus.get(st.status) ?? 0) + 1);
    }
    return out;
  }, [data, views]);

  const members = [...(data?.members ?? [])].sort((a, b) => (stats.get(b.id)?.added ?? 0) - (stats.get(a.id)?.added ?? 0));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
        <h1 className="text-2xl font-extrabold md:text-3xl">Friends</h1>
        <p className="text-sm text-muted">
          {members.length} {members.length === 1 ? "person" : "people"} · {views.length} places
        </p>

        {me && <MyProfile key={me.id} me={me} />}

        <div className="mt-6">
          <SectionLabel>The group</SectionLabel>
          <ul className="overflow-hidden rounded-2xl border border-line bg-white">
            {members.map((m) => {
              const s = stats.get(m.id)!;
              const open = openId === m.id;
              const recent = views
                .filter((v) => v.created_by === m.id)
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 3);
              return (
                <li key={m.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : m.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper/60"
                  >
                    <Avatar member={m} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-bold">
                        {m.name}
                        {m.id === me?.id && <span className="text-xs font-semibold text-muted">(you)</span>}
                        {m.role === "admin" && <ShieldCheck size={14} className="text-accent" aria-label="Admin" />}
                      </span>
                      <span className="text-xs text-muted">
                        {s.byStatus.get("visited") ?? 0} visited · {(s.byStatus.get("want") ?? 0) + (s.byStatus.get("planning") ?? 0)} on the list
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-lg leading-none font-extrabold">{s.added}</span>
                      <span className="text-[11px] text-muted">added</span>
                    </span>
                  </button>
                  {open && (
                    <div className="animate-fade px-4 pb-4">
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                        {CATEGORIES.map((c) => (
                          <div key={c.id} className="flex flex-col items-center rounded-xl bg-paper py-2">
                            <c.Icon size={16} style={{ color: c.color }} />
                            <span className="text-sm font-extrabold">{s.byCat.get(c.id) ?? 0}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-4 text-sm">
                        {STATUSES.map((st) => (
                          <span key={st.id} className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
                            {st.label} <b>{s.byStatus.get(st.id) ?? 0}</b>
                          </span>
                        ))}
                      </div>
                      {recent.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <div className="text-xs font-bold text-muted uppercase">Recently added</div>
                          {recent.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => select(v.id)}
                              className="flex w-full items-center gap-2.5 text-left text-sm"
                            >
                              <CategoryIcon id={v.category} size="sm" />
                              <span className="truncate font-semibold">{v.name}</span>
                              <span className="truncate text-muted">{v.area}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {isAdmin && <AdminPanel members={data?.members ?? []} />}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => repo.signOut()}>
            <LogOut size={16} /> {repo.mode === "demo" ? "Switch person" : "Sign out"}
          </Button>
          {repo.mode === "demo" && (
            <span className="text-xs text-muted">Demo mode: data is stored in this browser only.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MyProfile({ me }: { me: Member }) {
  const { run } = useStore();
  const [name, setName] = useState(me.name);
  const dirty = name.trim() && name.trim() !== me.name;
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
      <Avatar member={me} size={48} />
      <div className="min-w-0 flex-1">
        <label className="text-xs font-bold text-muted uppercase" htmlFor="my-name">
          Your name
        </label>
        <input
          id="my-name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          className="block w-full bg-transparent text-lg font-bold outline-none"
        />
        <div className="truncate text-xs text-muted">{me.email}</div>
      </div>
      {dirty && <Button onClick={() => run((r) => r.updateMyName(name.trim()), "Name updated")}>Save</Button>}
    </div>
  );
}

function AdminPanel({ members }: { members: Member[] }) {
  const { data, run, me, repo, toast } = useStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [issued, setIssued] = useState<{ email: string; link: string; reset: boolean } | null>(null);

  async function issue(target: string, targetRole: Role, reset: boolean) {
    const link = await run((r) => r.invite(target, targetRole), repo.mode === "demo" ? `Added ${target}` : undefined);
    if (link) setIssued({ email: target.trim().toLowerCase(), link, reset });
  }
  const message = issued
    ? issued.reset
      ? `Here's a link to reset your Wanderlist password (valid 7 days, works once): ${issued.link}`
      : `Join our Wanderlist, the group map of places we want to try (link valid 7 days, works once): ${issued.link}`
    : "";
  const joined = new Set(members.map((m) => m.email));
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="mt-8">
      <SectionLabel>Admin · Invites</SectionLabel>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          await issue(email, role, false);
          setEmail("");
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@gmail.com"
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-base outline-none focus:border-ink"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-xl border border-line bg-white px-2 text-sm font-semibold"
          aria-label="Role"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button type="submit" disabled={!valid}>
          <UserPlus size={16} /> Invite
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted">
        {repo.mode === "demo"
          ? "Demo mode: invited people can be picked on the sign-in screen straight away."
          : "You get a one-time link to send them. No email is sent. Removing someone cuts off access immediately."}
      </p>

      {issued && (
        <div className="animate-fade mt-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm">
              <b>{issued.reset ? "Password reset link" : "Invite link"}</b> for {issued.email}
              <div className="mt-1 text-xs text-muted">Valid for 7 days and works once. Anyone with it can join as this person, so send it privately.</div>
            </div>
            <IconButton label="Dismiss" onClick={() => setIssued(null)}>
              <X size={16} />
            </IconButton>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("primary")}
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message);
                  toast("Copied");
                } catch {
                  toast("Couldn't copy. Long-press the link instead.", "error");
                }
              }}
            >
              <Copy size={16} /> Copy
            </Button>
          </div>
          <div className="mt-2 truncate text-xs text-muted select-all">{issued.link}</div>
        </div>
      )}

      <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
        {(data?.invites ?? []).map((inv) => (
          <li key={inv.email} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
            <span className="min-w-0 flex-1 truncate">{inv.email}</span>
            <span className={cx("text-xs font-semibold", joined.has(inv.email) ? "text-green-700" : "text-muted")}>
              {joined.has(inv.email) ? "Joined" : "Pending"}
            </span>
            <span className="w-14 text-xs text-muted">{inv.role === "admin" ? "Admin" : "Member"}</span>
            {repo.mode === "supabase" && (
              <IconButton
                label={joined.has(inv.email) ? `Password reset link for ${inv.email}` : `New invite link for ${inv.email}`}
                onClick={() => issue(inv.email, inv.role, joined.has(inv.email))}
              >
                <KeyRound size={16} />
              </IconButton>
            )}
            {inv.email !== me?.email ? (
              <IconButton label={`Remove ${inv.email}`} onClick={() => run((r) => r.uninvite(inv.email), "Access removed")}>
                <X size={16} />
              </IconButton>
            ) : (
              <span className="w-9" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

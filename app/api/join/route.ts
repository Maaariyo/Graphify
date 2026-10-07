import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Turns a one-time invite link into a ready-to-use account, so login never depends on email delivery.
// Runs server-side only: it needs the service-role key, which must never reach the browser.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function lookup(sb: NonNullable<ReturnType<typeof admin>>, token: unknown) {
  if (typeof token !== "string" || !/^[0-9a-f]{48}$/.test(token)) return null;
  const { data } = await sb
    .from("invite_tokens")
    .select("email, expires_at")
    .eq("token_hash", hash(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  const { data: profile } = await sb.from("profiles").select("id, name").eq("email", data.email).maybeSingle();
  return { email: data.email as string, profile: profile as { id: string; name: string } | null };
}

const notConfigured = () =>
  Response.json({ error: "Server is missing SUPABASE_SERVICE_ROLE_KEY. See README step 2." }, { status: 500 });
const badLink = () =>
  Response.json({ error: "This link is invalid, already used or expired. Ask an admin for a new one." }, { status: 404 });

/**
 * `{ token, check: true }` → who the link is for (page says "Joining as x" or "Reset password for x").
 * `{ token, password, name? }` → creates the account, or sets a new password if it already exists.
 */
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (e) {
    console.error("join failed", e);
    return Response.json({ error: "Something went wrong on our side. Try again, or ask the admin for a new link." }, { status: 500 });
  }
}

async function handle(request: Request) {
  const sb = admin();
  if (!sb) return notConfigured();
  const body = (await request.json().catch(() => ({}))) as { token?: string; name?: string; password?: string; check?: boolean };
  const invite = await lookup(sb, body.token);
  if (!invite) return badLink();

  if (body.check) return Response.json({ email: invite.email, existing: !!invite.profile, name: invite.profile?.name ?? null });

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) return Response.json({ error: "Use at least 8 characters." }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";

  let userId = invite.profile?.id;
  if (userId) {
    const { error } = await sb.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) return Response.json({ error: error.message }, { status: 400 });
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email: invite.email, password, email_confirm: true });
    if (error || !data.user) return Response.json({ error: error?.message ?? "Could not create the account" }, { status: 400 });
    userId = data.user.id;
  }
  if (name) await sb.from("profiles").update({ name }).eq("id", userId);

  // Single use.
  await sb.from("invite_tokens").delete().eq("email", invite.email);
  return Response.json({ email: invite.email });
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Invite, Member, Place, PlaceInput, PlaceStatus, Plan, PlanPlace, Role, Snapshot, Status } from "../types";
import type { AuthState, Repo } from "./types";

interface ProfileRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Real mode: one shared Postgres database. Access rules live in supabase/schema.sql (RLS). */
export class SupabaseRepo implements Repo {
  readonly mode = "supabase" as const;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  private async userId(): Promise<string> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) throw new Error("Not signed in");
    return data.user.id;
  }

  async getAuth(): Promise<AuthState> {
    const { data } = await this.sb.auth.getSession();
    const user = data.session?.user;
    if (!user?.email) return { kind: "signed-out" };
    const email = user.email.toLowerCase();
    const invite = check(await this.sb.from("invites").select("email, role").eq("email", email).maybeSingle()) as Invite | null;
    if (!invite) return { kind: "not-invited", email };
    let profile = check(
      await this.sb.from("profiles").select("id, email, name, created_at").eq("id", user.id).maybeSingle(),
    ) as ProfileRow | null;
    if (!profile) {
      // The signup trigger normally creates this; covers users created before the schema was applied.
      profile = check(
        await this.sb
          .from("profiles")
          .insert({ id: user.id, email, name: email.split("@")[0] })
          .select("id, email, name, created_at")
          .single(),
      ) as ProfileRow;
    }
    return { kind: "signed-in", me: { ...profile, role: invite.role } };
  }

  async signIn(email: string, password = "") {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
  }

  private async callJoin(body: Record<string, unknown>) {
    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Something went wrong");
    return json;
  }

  async checkInvite(token: string) {
    return (await this.callJoin({ token, check: true })) as { email: string; existing: boolean; name: string | null };
  }

  async join(token: string, password: string, name: string) {
    const { email } = (await this.callJoin({ token, password, name })) as { email: string };
    await this.signIn(email, password);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") cb();
    });
    return () => data.subscription.unsubscribe();
  }

  async load(): Promise<Snapshot> {
    const [profiles, invites, places, statuses, plans, planPlaces] = await Promise.all([
      this.sb.from("profiles").select("id, email, name, created_at"),
      this.sb.from("invites").select("email, role"),
      this.sb.from("places").select("*").order("created_at", { ascending: false }),
      this.sb.from("place_status").select("*"),
      this.sb.from("plans").select("*").order("date", { ascending: true, nullsFirst: false }),
      this.sb.from("plan_places").select("*"),
    ]);
    const inv = check(invites) as Invite[];
    const roleByEmail = new Map(inv.map((i) => [i.email, i.role]));
    const members: Member[] = (check(profiles) as ProfileRow[])
      .filter((p) => roleByEmail.has(p.email))
      .map((p) => ({ ...p, role: roleByEmail.get(p.email)! }));
    return {
      members,
      invites: inv,
      places: check(places) as Place[],
      statuses: check(statuses) as PlaceStatus[],
      plans: check(plans) as Plan[],
      planPlaces: check(planPlaces) as PlanPlace[],
    };
  }

  subscribe(cb: () => void) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(cb, 300);
    };
    const channel = this.sb.channel("wanderlist-changes");
    for (const table of ["places", "place_status", "plans", "plan_places", "profiles", "invites"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void this.sb.removeChannel(channel);
    };
  }

  async addPlace(input: PlaceInput, status: Status): Promise<Place> {
    const me = await this.userId();
    const place = check(await this.sb.from("places").insert({ ...input, created_by: me }).select("*").single()) as Place;
    check(await this.sb.from("place_status").insert({ place_id: place.id, user_id: me, status }));
    return place;
  }

  async updatePlace(id: string, patch: Partial<PlaceInput>) {
    const rows = check(await this.sb.from("places").update(patch).eq("id", id).select("id")) as { id: string }[];
    if (rows.length === 0) throw new Error("Only the person who added it (or an admin) can edit");
  }

  async deletePlace(id: string) {
    const rows = check(await this.sb.from("places").delete().eq("id", id).select("id")) as { id: string }[];
    if (rows.length === 0) throw new Error("Only the person who added it (or an admin) can delete");
  }

  async setStatus(placeId: string, status: Status | null, rating?: number | null) {
    const me = await this.userId();
    if (status === null) {
      check(await this.sb.from("place_status").delete().eq("place_id", placeId).eq("user_id", me));
      return;
    }
    const row: Record<string, unknown> = { place_id: placeId, user_id: me, status };
    if (rating !== undefined) row.rating = rating;
    check(await this.sb.from("place_status").upsert(row, { onConflict: "place_id,user_id" }));
  }

  async createPlan(name: string, date: string | null) {
    const me = await this.userId();
    const plan = check(await this.sb.from("plans").insert({ name, date, created_by: me }).select("id").single()) as {
      id: string;
    };
    return plan.id;
  }

  async updatePlan(id: string, patch: { name?: string; date?: string | null }) {
    check(await this.sb.from("plans").update(patch).eq("id", id));
  }

  async deletePlan(id: string) {
    const rows = check(await this.sb.from("plans").delete().eq("id", id).select("id")) as { id: string }[];
    if (rows.length === 0) throw new Error("Only the plan's creator (or an admin) can delete it");
  }

  async setPlanPlaces(planId: string, placeIds: string[]) {
    check(await this.sb.from("plan_places").delete().eq("plan_id", planId));
    if (placeIds.length) {
      check(
        await this.sb
          .from("plan_places")
          .insert(placeIds.map((place_id, position) => ({ plan_id: planId, place_id, position }))),
      );
    }
  }

  async updateMyName(name: string) {
    const me = await this.userId();
    check(await this.sb.from("profiles").update({ name }).eq("id", me));
  }

  async invite(email: string, role: Role) {
    const token = check(await this.sb.rpc("create_invite_link", { p_email: email, p_role: role })) as string;
    return `${window.location.origin}/join#${token}`;
  }

  async uninvite(email: string) {
    check(await this.sb.from("invites").delete().eq("email", email));
  }
}

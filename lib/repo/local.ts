import type { Place, PlaceInput, Role, Snapshot, Status } from "../types";
import { seedSnapshot } from "./seed";
import type { AuthState, Repo } from "./types";

const DATA_KEY = "wanderlist-demo-v1";
const USER_KEY = "wanderlist-demo-user";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Demo mode: the whole group's data lives in this browser's localStorage. */
export class LocalRepo implements Repo {
  readonly mode = "demo" as const;
  private listeners = new Set<() => void>();
  private authListeners = new Set<() => void>();

  private read(): Snapshot {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) return JSON.parse(raw) as Snapshot;
    } catch {
      /* fall through to seed */
    }
    const seed = seedSnapshot();
    this.write(seed, false);
    return seed;
  }

  private write(s: Snapshot, notify = true) {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(s));
    } catch {
      /* storage full or blocked: demo keeps working in memory for this render */
    }
    if (notify) this.listeners.forEach((l) => l());
  }

  private me(): string {
    const id = localStorage.getItem(USER_KEY);
    if (!id) throw new Error("Not signed in");
    return id;
  }

  private isAdmin(s: Snapshot, userId: string) {
    return s.members.find((m) => m.id === userId)?.role === "admin";
  }

  async getAuth(): Promise<AuthState> {
    const id = localStorage.getItem(USER_KEY);
    const me = id ? this.read().members.find((m) => m.id === id) : undefined;
    return me ? { kind: "signed-in", me } : { kind: "signed-out" };
  }

  async signIn(memberId: string) {
    localStorage.setItem(USER_KEY, memberId);
    this.authListeners.forEach((l) => l());
  }

  async signOut() {
    localStorage.removeItem(USER_KEY);
    this.authListeners.forEach((l) => l());
  }

  onAuthChange(cb: () => void) {
    this.authListeners.add(cb);
    return () => void this.authListeners.delete(cb);
  }

  async load() {
    return this.read();
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    const onStorage = (e: StorageEvent) => e.key === DATA_KEY && cb();
    window.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  }

  async addPlace(input: PlaceInput, status: Status): Promise<Place> {
    const s = this.read();
    const me = this.me();
    const now = new Date().toISOString();
    const place: Place = { ...input, id: uid("p"), created_by: me, created_at: now, updated_at: now };
    s.places.push(place);
    s.statuses.push({ place_id: place.id, user_id: me, status, rating: null, updated_at: now });
    this.write(s);
    return place;
  }

  async updatePlace(id: string, patch: Partial<PlaceInput>) {
    const s = this.read();
    const me = this.me();
    const p = s.places.find((x) => x.id === id);
    if (!p) throw new Error("Place not found");
    if (p.created_by !== me && !this.isAdmin(s, me)) throw new Error("Only the person who added it (or an admin) can edit");
    Object.assign(p, patch, { updated_at: new Date().toISOString() });
    this.write(s);
  }

  async deletePlace(id: string) {
    const s = this.read();
    const me = this.me();
    const p = s.places.find((x) => x.id === id);
    if (p && p.created_by !== me && !this.isAdmin(s, me)) throw new Error("Only the person who added it (or an admin) can delete");
    s.places = s.places.filter((x) => x.id !== id);
    s.statuses = s.statuses.filter((x) => x.place_id !== id);
    s.planPlaces = s.planPlaces.filter((x) => x.place_id !== id);
    this.write(s);
  }

  async setStatus(placeId: string, status: Status | null, rating?: number | null) {
    const s = this.read();
    const me = this.me();
    const existing = s.statuses.find((x) => x.place_id === placeId && x.user_id === me);
    if (status === null) {
      s.statuses = s.statuses.filter((x) => x !== existing);
    } else if (existing) {
      existing.status = status;
      if (rating !== undefined) existing.rating = rating;
      existing.updated_at = new Date().toISOString();
    } else {
      s.statuses.push({ place_id: placeId, user_id: me, status, rating: rating ?? null, updated_at: new Date().toISOString() });
    }
    this.write(s);
  }

  async createPlan(name: string, date: string | null) {
    const s = this.read();
    const id = uid("plan");
    s.plans.push({ id, name, date, created_by: this.me(), created_at: new Date().toISOString() });
    this.write(s);
    return id;
  }

  async updatePlan(id: string, patch: { name?: string; date?: string | null }) {
    const s = this.read();
    const plan = s.plans.find((p) => p.id === id);
    if (plan) Object.assign(plan, patch);
    this.write(s);
  }

  async deletePlan(id: string) {
    const s = this.read();
    s.plans = s.plans.filter((p) => p.id !== id);
    s.planPlaces = s.planPlaces.filter((p) => p.plan_id !== id);
    this.write(s);
  }

  async setPlanPlaces(planId: string, placeIds: string[]) {
    const s = this.read();
    s.planPlaces = s.planPlaces
      .filter((p) => p.plan_id !== planId)
      .concat(placeIds.map((place_id, position) => ({ plan_id: planId, place_id, position })));
    this.write(s);
  }

  async updateMyName(name: string) {
    const s = this.read();
    const m = s.members.find((x) => x.id === this.me());
    if (m) m.name = name;
    this.write(s);
    this.authListeners.forEach((l) => l());
  }

  async invite(email: string, role: Role) {
    const s = this.read();
    const e = email.trim().toLowerCase();
    if (!s.invites.some((i) => i.email === e)) s.invites.push({ email: e, role });
    // In demo mode an invite immediately becomes a member so you can "sign in" as them.
    if (!s.members.some((m) => m.email === e)) {
      const name = e.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      s.members.push({ id: uid("u"), name, email: e, role, created_at: new Date().toISOString() });
    }
    this.write(s);
  }

  async uninvite(email: string) {
    const s = this.read();
    if (s.members.find((m) => m.email === email)?.id === this.me()) throw new Error("You can't remove yourself");
    s.invites = s.invites.filter((i) => i.email !== email);
    s.members = s.members.filter((m) => m.email !== email);
    this.write(s);
  }
}

export function resetDemoData() {
  localStorage.removeItem(DATA_KEY);
}

import type { Member, PlaceInput, Place, Role, Snapshot, Status } from "../types";

export type AuthState =
  | { kind: "signed-out" }
  | { kind: "not-invited"; email: string }
  | { kind: "signed-in"; me: Member };

/**
 * Everything the UI does to data goes through this interface.
 * Two implementations: LocalRepo (demo, browser storage) and SupabaseRepo (real, shared).
 */
export interface Repo {
  readonly mode: "demo" | "supabase";
  getAuth(): Promise<AuthState>;
  /** Demo: `who` is a member id. Supabase: email + password (no email is ever sent). */
  signIn(who: string, password?: string): Promise<void>;
  /** Supabase only: who an invite link is for, before they set a password. */
  checkInvite?(token: string): Promise<{ email: string; existing: boolean; name: string | null }>;
  /** Supabase only: redeem an invite link (new account, or password reset) and sign in. */
  join?(token: string, password: string, name: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;

  load(): Promise<Snapshot>;
  subscribe(cb: () => void): () => void;

  addPlace(input: PlaceInput, status: Status): Promise<Place>;
  updatePlace(id: string, patch: Partial<PlaceInput>): Promise<void>;
  deletePlace(id: string): Promise<void>;
  /** `null` removes the place from my list. */
  setStatus(placeId: string, status: Status | null, rating?: number | null): Promise<void>;

  createPlan(name: string, date: string | null): Promise<string>;
  updatePlan(id: string, patch: { name?: string; date?: string | null }): Promise<void>;
  deletePlan(id: string): Promise<void>;
  setPlanPlaces(planId: string, placeIds: string[]): Promise<void>;

  updateMyName(name: string): Promise<void>;
  /** Returns the join link to send (Supabase), or null in demo mode where invites join instantly. */
  invite(email: string, role: Role): Promise<string | null>;
  uninvite(email: string): Promise<void>;
}

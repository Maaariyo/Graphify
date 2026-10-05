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
  /** Demo: `who` is a member id. Supabase: `who` is an email; a code + link is emailed. */
  signIn(who: string): Promise<void>;
  /** Supabase only: the 6-digit code from the sign-in email. Works inside an installed iPhone app, where links don't. */
  verifyCode?(email: string, code: string): Promise<void>;
  /** Supabase only, when Google is enabled in the Supabase dashboard. */
  signInWithGoogle?(): Promise<void>;
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
  invite(email: string, role: Role): Promise<void>;
  uninvite(email: string): Promise<void>;
}

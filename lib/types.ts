export type CategoryId =
  | "eat"
  | "cafe"
  | "adventure"
  | "chill"
  | "trail"
  | "culture"
  | "activity"
  | "night";

/** Status is per person, not per place: Aditi can have "visited" while Kuber has "want". */
export type Status = "want" | "planning" | "visited";

export type Role = "member" | "admin";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  area: string | null;
  category: CategoryId;
  note: string | null;
  source_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One row per (person, place). A row existing = that person has "saved" the place. */
export interface PlaceStatus {
  place_id: string;
  user_id: string;
  status: Status;
  rating: number | null;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  date: string | null; // YYYY-MM-DD
  created_by: string | null;
  created_at: string;
}

export interface PlanPlace {
  plan_id: string;
  place_id: string;
  position: number;
}

export interface Invite {
  email: string;
  role: Role;
}

export interface Snapshot {
  members: Member[];
  invites: Invite[];
  places: Place[];
  statuses: PlaceStatus[];
  plans: Plan[];
  planPlaces: PlanPlace[];
}

export interface PlaceInput {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  area: string | null;
  category: CategoryId;
  note: string | null;
  source_url: string | null;
}

/** A place joined with everything the UI needs to render it. */
export interface PlaceView extends Place {
  addedBy: Member | null;
  savers: PlaceStatus[];
  mine: PlaceStatus | null;
  avgRating: number | null;
  distanceKm: number | null;
}

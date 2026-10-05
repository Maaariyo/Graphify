import {
  Coffee,
  Footprints,
  Gamepad2,
  Landmark,
  Leaf,
  type LucideIcon,
  Moon,
  Mountain,
  Utensils,
} from "lucide-react";
import type { CategoryId, Status } from "./types";

export interface Category {
  id: CategoryId;
  label: string;
  short: string;
  Icon: LucideIcon;
  color: string;
}

/**
 * Categories live in code, not in a table. Eight rows that change once a year
 * do not need an admin UI. Add one here and in the `places.category` check in schema.sql.
 */
export const CATEGORIES: Category[] = [
  { id: "eat", label: "Eating", short: "Eat", Icon: Utensils, color: "#D9480F" },
  { id: "cafe", label: "Cafe", short: "Cafe", Icon: Coffee, color: "#8C5A3C" },
  { id: "adventure", label: "Adventure", short: "Adventure", Icon: Mountain, color: "#1C7ED6" },
  { id: "chill", label: "Chill", short: "Chill", Icon: Leaf, color: "#2B8A3E" },
  { id: "trail", label: "Walk / Trail", short: "Trails", Icon: Footprints, color: "#6B7A1F" },
  { id: "culture", label: "Culture", short: "Culture", Icon: Landmark, color: "#7048E8" },
  { id: "activity", label: "Activity", short: "Activity", Icon: Gamepad2, color: "#E67700" },
  { id: "night", label: "Night", short: "Night", Icon: Moon, color: "#364FC7" },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;

export const STATUSES: { id: Status; label: string; color: string }[] = [
  { id: "want", label: "Want to go", color: "#E03131" },
  { id: "planning", label: "Planning", color: "#F08C00" },
  { id: "visited", label: "Visited", color: "#2F9E44" },
];

export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s])) as Record<
  Status,
  (typeof STATUSES)[number]
>;

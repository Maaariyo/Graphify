import type { CategoryId, Snapshot, Status } from "../types";

/** Sample Delhi NCR data for demo mode. Coordinates are approximate. */
const MEMBERS = [
  { id: "u-kuber", name: "Kuber", email: "kuber@example.com", role: "admin" as const },
  { id: "u-rahul", name: "Rahul", email: "rahul@example.com", role: "member" as const },
  { id: "u-aditi", name: "Aditi", email: "aditi@example.com", role: "member" as const },
  { id: "u-rohan", name: "Rohan", email: "rohan@example.com", role: "member" as const },
];

type SeedPlace = [string, number, number, string, CategoryId, string, string | null];

const PLACES: SeedPlace[] = [
  ["Cafe Delhi Heights", 28.5538, 77.1942, "Hauz Khas", "eat", "u-kuber", "Try this for Sunday brunch."],
  ["Damdama Lake", 28.2969, 77.1325, "Gurgaon", "adventure", "u-rahul", "Kayaking + zipline. Go early, it gets hot."],
  ["Lodhi Garden", 28.5931, 77.2197, "Central Delhi", "chill", "u-aditi", "Picnic spot. Carry a mat."],
  ["Blue Tokai, Champa Gali", 28.5197, 77.1971, "Saket", "cafe", "u-aditi", null],
  ["Sunder Nursery", 28.5933, 77.2440, "Nizamuddin", "chill", "u-rohan", "Winter afternoons are perfect here."],
  ["Mehrauli Archaeological Park", 28.5206, 77.1856, "Mehrauli", "trail", "u-kuber", "Heritage walk, ~2 hrs."],
  ["Asola Bhatti Wildlife Sanctuary", 28.4630, 77.2280, "Asola", "trail", "u-rahul", "Proper trail, wear shoes."],
  ["Majnu ka Tilla", 28.7024, 77.2276, "North Delhi", "eat", "u-rohan", "Laphing + Tibetan food crawl."],
  ["Paranthe Wali Gali", 28.6560, 77.2306, "Chandni Chowk", "eat", "u-kuber", "Combine with a Chandni Chowk walk."],
  ["Kiran Nadar Museum of Art", 28.5280, 77.2186, "Saket", "culture", "u-aditi", "Check what exhibition is on."],
  ["Qutub Minar", 28.5245, 77.1855, "Mehrauli", "culture", "u-rahul", null],
  ["Sanjay Van", 28.5395, 77.1780, "Vasant Kunj", "trail", "u-rohan", "Morning walk, peacocks everywhere."],
  ["PCO", 28.5577, 77.1606, "Vasant Vihar", "night", "u-kuber", "Speakeasy, book ahead."],
  ["Timezone, Select Citywalk", 28.5286, 77.2190, "Saket", "activity", "u-rahul", "Bowling + arcade."],
  ["Perch Wine & Coffee Bar", 28.6004, 77.2271, "Khan Market", "cafe", "u-aditi", null],
  ["Big Chill Cafe", 28.6003, 77.2268, "Khan Market", "eat", "u-kuber", "Desserts. Order the Mississippi mud pie."],
  ["Aravalli Biodiversity Park", 28.4950, 77.1210, "Gurgaon", "trail", "u-rohan", null],
  ["Dhauj Rock Climbing", 28.3450, 77.2310, "Faridabad", "adventure", "u-rahul", "Need to book an instructor."],
  ["Hauz Khas Lake & Deer Park", 28.5525, 77.1925, "Hauz Khas", "chill", "u-aditi", null],
  ["Kingdom of Dreams", 28.4679, 77.0682, "Gurgaon", "culture", "u-rohan", "Musical show on weekends."],
];

const STATUSES: [string, number, Status, number | null][] = [
  ["u-kuber", 0, "want", null], ["u-rahul", 0, "want", null], ["u-aditi", 0, "visited", 4],
  ["u-rahul", 1, "planning", null], ["u-kuber", 1, "want", null], ["u-rohan", 1, "want", null],
  ["u-aditi", 2, "visited", 5], ["u-kuber", 2, "visited", 4], ["u-rohan", 2, "visited", 5],
  ["u-aditi", 3, "visited", 4], ["u-kuber", 3, "want", null],
  ["u-rohan", 4, "want", null], ["u-aditi", 4, "want", null],
  ["u-kuber", 5, "want", null], ["u-rahul", 5, "want", null],
  ["u-rahul", 6, "want", null],
  ["u-rohan", 7, "visited", 5], ["u-kuber", 7, "want", null], ["u-rahul", 7, "want", null],
  ["u-kuber", 8, "planning", null],
  ["u-aditi", 9, "want", null],
  ["u-rahul", 10, "visited", 4],
  ["u-rohan", 11, "visited", 4],
  ["u-kuber", 12, "want", null], ["u-rahul", 12, "want", null], ["u-aditi", 12, "want", null],
  ["u-rahul", 13, "visited", 3], ["u-rohan", 13, "want", null],
  ["u-aditi", 14, "want", null],
  ["u-kuber", 15, "visited", 4], ["u-aditi", 15, "visited", 5],
  ["u-rohan", 16, "want", null],
  ["u-rahul", 17, "want", null], ["u-kuber", 17, "want", null],
  ["u-aditi", 18, "visited", 4],
  ["u-rohan", 19, "want", null],
];

export function seedSnapshot(): Snapshot {
  const now = Date.now();
  const day = 86400000;
  const places = PLACES.map(([name, lat, lng, area, category, created_by, note], i) => {
    const ts = new Date(now - (PLACES.length - i) * day * 2).toISOString();
    return {
      id: `p-${i + 1}`,
      name,
      lat,
      lng,
      address: null,
      area,
      category,
      note,
      source_url: null,
      created_by,
      created_at: ts,
      updated_at: ts,
    };
  });
  const statuses = STATUSES.map(([user_id, idx, status, rating]) => ({
    place_id: places[idx].id,
    user_id,
    status,
    rating,
    updated_at: places[idx].created_at,
  }));
  const saturday = new Date(now);
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7 || 7));
  return {
    members: MEMBERS.map((m) => ({ ...m, created_at: new Date(now - 60 * day).toISOString() })),
    invites: MEMBERS.map((m) => ({ email: m.email, role: m.role })),
    places,
    statuses,
    plans: [
      {
        id: "plan-1",
        name: "Saturday in South Delhi",
        date: saturday.toISOString().slice(0, 10),
        created_by: "u-kuber",
        created_at: new Date(now - day).toISOString(),
      },
    ],
    planPlaces: [
      { plan_id: "plan-1", place_id: "p-6", position: 0 },
      { plan_id: "plan-1", place_id: "p-1", position: 1 },
      { plan_id: "plan-1", place_id: "p-4", position: 2 },
    ],
  };
}

/**
 * TCGdex has ~40 rarity strings across 25 years of sets. Collectors think in
 * far fewer buckets, so we group them for the filter and the card badge.
 */
export type RarityGroup = {
  key: string;
  label: string;
  color: string; // badge background
  test: (rarity: string) => boolean; // rarity is lowercased
};

/** Display order for the filter chips. */
export const RARITY_GROUPS: RarityGroup[] = [
  { key: "common", label: "Common", color: "#6b7280", test: (r) => r === "common" },
  { key: "uncommon", label: "Uncommon", color: "#4b5563", test: (r) => r === "uncommon" },
  {
    key: "rare",
    label: "Rare / Holo",
    color: "#2563eb",
    test: (r) => ["rare", "holo rare", "rare holo"].includes(r),
  },
  {
    key: "v-ex",
    label: "ex / V / VMAX / VSTAR / GX",
    color: "#7c3aed",
    test: (r) =>
      /double rare|\bv\b|vmax|vstar|v-union|lv\.x|\bex\b|\bgx\b|break|prime|legend|\bstar\b/.test(r),
  },
  {
    key: "full-art",
    label: "Full Art / Ultra Rare",
    color: "#4f46e5",
    test: (r) => r === "ultra rare" || r.includes("full art"),
  },
  { key: "ir", label: "IR", color: "#0d9488", test: (r) => r === "illustration rare" },
  { key: "sir", label: "SIR", color: "#db2777", test: (r) => r === "special illustration rare" },
  {
    key: "gold",
    label: "Gold / Secret / Rainbow",
    color: "#b45309",
    test: (r) => /hyper|secret|rainbow/.test(r),
  },
  { key: "shiny", label: "Shiny", color: "#0891b2", test: (r) => r.includes("shiny") },
  { key: "promo", label: "Promo", color: "#475569", test: (r) => r === "promo" || r === "none" },
];

export const OTHER_GROUP: RarityGroup = {
  key: "other",
  label: "Other (Radiant, ACE SPEC…)",
  color: "#6b7280",
  test: () => true,
};

/** Match order: specific buckets first, so "Shiny rare V" lands in Shiny, not V. */
const MATCH_ORDER = ["shiny", "gold", "sir", "ir", "full-art", "v-ex", "rare", "common", "uncommon", "promo"];
const BY_KEY = Object.fromEntries(RARITY_GROUPS.map((g) => [g.key, g]));

export function rarityGroup(rarity: string | null): RarityGroup {
  if (!rarity) return OTHER_GROUP;
  const r = rarity.toLowerCase();
  for (const key of MATCH_ORDER) {
    if (BY_KEY[key].test(r)) return BY_KEY[key];
  }
  return OTHER_GROUP;
}

/** Short text for the badge on a card. */
export function rarityBadge(rarity: string): string {
  const r = rarity.toLowerCase();
  if (r === "special illustration rare") return "SIR";
  if (r === "illustration rare") return "IR";
  if (r === "none") return "Promo";
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { CardTile, CARD_COLUMNS, SWATCH, type Card } from "@/components/CardTile";
import { OTHER_GROUP, RARITY_GROUPS, rarityGroup } from "@/lib/rarity";

const PAGE_SIZE = 60;
const NO_CARDS = new Set<string>();
const ALL_GROUPS = [...RARITY_GROUPS, OTHER_GROUP];

/**
 * Split "snorlax 51" into a name part and a card-number part.
 * The number token can look like 51, 051, #51, 051/165, TG05, GG01, SV049.
 */
function parseQuery(raw: string) {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const isNumber = (t: string) => /^#?[A-Za-z]{0,4}\d+(\/[A-Za-z]{0,4}\d+)?$/.test(t);
  const numberToken = [...tokens].reverse().find(isNumber);
  const name = tokens.filter((t) => t !== numberToken).join(" ");

  let localIds: string[] = [];
  if (numberToken) {
    const base = numberToken.replace(/^#/, "").split("/")[0].toUpperCase();
    const m = base.match(/^([A-Z]*)(\d+)$/);
    if (m) {
      const [, prefix, digits] = m;
      const n = parseInt(digits, 10);
      // Card numbers are stored inconsistently ("51", "051", "TG05"), so try the variants
      localIds = [
        ...new Set([
          `${prefix}${digits}`,
          `${prefix}${n}`,
          `${prefix}${String(n).padStart(2, "0")}`,
          `${prefix}${String(n).padStart(3, "0")}`,
        ]),
      ];
    }
  }
  return { name, localIds };
}

export default function SearchPage() {
  const router = useRouter();
  const { user } = useUser();

  const [query, setQuery] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  // For each rarity group: the raw TCGdex rarity strings in it and the total card count
  const [groups, setGroups] = useState<Record<string, { rarities: string[]; count: number }>>({});
  const groupRarities = groupKey ? groups[groupKey]?.rarities ?? [] : [];
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(NO_CARDS);
  const owned = user ? ownedIds : NO_CARDS;

  // Load every rarity in the database and sort it into collector-friendly groups
  useEffect(() => {
    supabase.rpc("card_rarities").then(({ data, error }) => {
      if (error || !data) return;
      const next: Record<string, { rarities: string[]; count: number }> = {};
      for (const { rarity, count } of data as { rarity: string; count: number }[]) {
        const key = rarityGroup(rarity).key;
        next[key] ??= { rarities: [], count: 0 };
        next[key].rarities.push(rarity);
        next[key].count += Number(count);
      }
      setGroups(next);
    });
  }, []);

  // Re-run the search 300ms after any filter changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      const { name, localIds } = parseQuery(query);

      let q = supabase
        .from("cards")
        .select(CARD_COLUMNS)
        .order("name")
        .order("set_name")
        .order("local_id")
        .limit(limit);

      if (name) q = q.ilike("name", `%${name}%`);
      if (localIds.length) q = q.in("local_id", localIds);
      if (groupKey) q = q.in("rarity", groupRarities);
      if (color) q = q.contains("colors", [color]);

      const { data, error } = await q;
      if (error) setError(error.message);
      else setCards((data ?? []) as Card[]);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
    // groupRarities is derived from groupKey + groups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, color, groupKey, groups, limit]);

  // Which cards the signed-in user already owns
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_cards")
      .select("card_id")
      .then(({ data }) => setOwnedIds(new Set((data ?? []).map((r) => r.card_id as string))));
  }, [user]);

  async function toggleOwned(cardId: string) {
    if (!user) {
      router.push("/login");
      return;
    }
    if (owned.has(cardId)) {
      const { error } = await supabase
        .from("user_cards")
        .delete()
        .eq("user_id", user.id)
        .eq("card_id", cardId);
      if (error) return setError(error.message);
      setOwnedIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("user_cards")
        .insert({ user_id: user.id, card_id: cardId });
      if (error) return setError(error.message);
      setOwnedIds((prev) => new Set(prev).add(cardId));
    }
  }

  const hasFilters = query || color || groupKey;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-3xl font-bold">Find cards</h1>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE_SIZE);
        }}
        placeholder="Name and/or number, e.g. Snorlax 51 or Giratina TG05"
        className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-black"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-gray-500">Rarity</span>
        {ALL_GROUPS.filter((g) => groups[g.key]).map((g) => (
          <button
            key={g.key}
            onClick={() => {
              setGroupKey(groupKey === g.key ? null : g.key);
              setLimit(PAGE_SIZE);
            }}
            title={groups[g.key].rarities.join(", ")}
            className={`rounded-full border px-3 py-1 text-sm ${
              groupKey === g.key ? "text-white" : "border-gray-500"
            }`}
            style={groupKey === g.key ? { background: g.color, borderColor: g.color } : undefined}
          >
            {g.label} <span className="opacity-60">{groups[g.key].count}</span>
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-gray-500">Color</span>
        {Object.entries(SWATCH).map(([name, hex]) => (
          <button
            key={name}
            onClick={() => {
              setColor(color === name ? null : name);
              setLimit(PAGE_SIZE);
            }}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
              color === name ? "border-white bg-white/20" : "border-gray-500"
            }`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: hex }} />
            {name}
          </button>
        ))}
        {hasFilters && (
          <button
            onClick={() => {
              setQuery("");
              setColor(null);
              setGroupKey(null);
              setLimit(PAGE_SIZE);
            }}
            className="ml-2 text-sm underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="text-red-500">{error}</p>}
      {loading && cards.length === 0 && <p className="text-gray-400">Searching…</p>}
      {!loading && cards.length === 0 && <p className="text-gray-400">No cards found.</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {cards.map((card) => {
          const isOwned = owned.has(card.id);
          return (
            <CardTile
              key={card.id}
              card={card}
              action={
                <button
                  onClick={() => toggleOwned(card.id)}
                  className={`w-full rounded-md px-2 py-1 text-xs font-medium ${
                    isOwned
                      ? "bg-green-600 text-white"
                      : "border border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {isOwned ? "✓ In collection" : "+ Add"}
                </button>
              }
            />
          );
        })}
      </div>

      {cards.length === limit && (
        <button
          onClick={() => setLimit(limit + PAGE_SIZE)}
          disabled={loading}
          className="mx-auto mt-6 block rounded-lg border border-gray-400 px-6 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}

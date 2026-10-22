"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { CardTile, SWATCH, type Card } from "@/components/CardTile";

const PAGE_SIZE = 60;
const NO_CARDS = new Set<string>();

export default function SearchPage() {
  const router = useRouter();
  const { user } = useUser();

  const [query, setQuery] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(NO_CARDS);
  const owned = user ? ownedIds : NO_CARDS;

  // Re-run the search 300ms after the user stops typing, picks a color, or loads more
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      let q = supabase
        .from("cards")
        .select("id, name, set_name, local_id, rarity, image_url, colors")
        .order("name")
        .order("set_name")
        .order("local_id")
        .limit(limit);

      if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
      if (color) q = q.contains("colors", [color]);

      const { data, error } = await q;
      if (error) setError(error.message);
      else setCards(data ?? []);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, color, limit]);

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

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-3xl font-bold">Find cards</h1>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE_SIZE);
        }}
        placeholder="Search by name, e.g. Giratina"
        className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-black"
      />

      <div className="mb-6 flex flex-wrap gap-2">
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

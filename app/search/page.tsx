"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cardImage } from "@/lib/cardImage";

type Card = {
  id: string;
  name: string;
  set_name: string | null;
  local_id: string | null;
  rarity: string | null;
  image_url: string | null;
  colors: string[];
};

const PAGE_SIZE = 60;

const SWATCH: Record<string, string> = {
  red: "#e53935",
  orange: "#fb8c00",
  yellow: "#fdd835",
  green: "#43a047",
  teal: "#00897b",
  blue: "#1e88e5",
  purple: "#8e24aa",
  pink: "#ec407a",
  brown: "#795548",
  black: "#212121",
  white: "#f5f5f5",
  gray: "#9e9e9e",
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        {cards.map((card) => (
          <div key={card.id}>
            {card.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cardImage(card.image_url)!}
                alt={card.name}
                loading="lazy"
                className="aspect-[63/88] w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex aspect-[63/88] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-400 p-2 text-center">
                <p className="text-sm font-medium">{card.name}</p>
                <p className="mt-1 text-xs text-gray-400">Image coming soon</p>
              </div>
            )}
            <p className="mt-1 truncate text-sm font-medium">{card.name}</p>
            <p className="truncate text-xs text-gray-400">
              {card.set_name} · {card.local_id}
            </p>
            <div className="mt-1 flex gap-1">
              {card.colors.map((c) => (
                <span
                  key={c}
                  title={c}
                  className="h-3 w-3 rounded-full border border-gray-600"
                  style={{ background: SWATCH[c] }}
                />
              ))}
            </div>
          </div>
        ))}
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
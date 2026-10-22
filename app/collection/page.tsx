"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { CardTile, CARD_COLUMNS, type Card } from "@/components/CardTile";

export default function CollectionPage() {
  const { user, loading: userLoading } = useUser();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_cards")
      .select(`added_at, cards(${CARD_COLUMNS})`)
      .order("added_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setCards((data ?? []).map((row) => row.cards as unknown as Card));
      });
  }, [user]);

  async function remove(cardId: string) {
    if (!user) return;
    const { error } = await supabase
      .from("user_cards")
      .delete()
      .eq("user_id", user.id)
      .eq("card_id", cardId);
    if (error) return setError(error.message);
    setCards((prev) => (prev ?? []).filter((c) => c.id !== cardId));
  }

  if (userLoading) return null;

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="mb-4 text-3xl font-bold">My collection</h1>
        <p>
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to start building your collection.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-3xl font-bold">My collection</h1>
      <p className="mb-6 text-sm text-gray-400">
        {cards === null ? "Loading…" : `${cards.length} card${cards.length === 1 ? "" : "s"}`}
      </p>

      {error && <p className="text-red-500">{error}</p>}

      {cards?.length === 0 && (
        <p>
          Nothing here yet.{" "}
          <Link href="/search" className="underline">
            Find some cards
          </Link>{" "}
          to add.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {cards?.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            action={
              <button
                onClick={() => remove(card.id)}
                className="w-full rounded-md border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Remove
              </button>
            }
          />
        ))}
      </div>
    </main>
  );
}

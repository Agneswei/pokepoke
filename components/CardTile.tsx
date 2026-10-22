import type { ReactNode } from "react";
import { cardImage } from "@/lib/cardImage";
import { rarityBadge, rarityGroup } from "@/lib/rarity";

export type Card = {
  id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  set_total: number | null;
  local_id: string | null;
  rarity: string | null;
  image_url: string | null;
  colors: string[];
};

/** Columns to select from the cards table to fill a Card. */
export const CARD_COLUMNS =
  "id, name, set_name, series, set_total, local_id, rarity, image_url, colors";

export const SWATCH: Record<string, string> = {
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

/** "155/163" like the bottom corner of the card, or just "TG05" for subsets. */
export function cardNumber(card: Pick<Card, "local_id" | "set_total">) {
  if (!card.local_id) return "";
  if (card.set_total && /^\d+$/.test(card.local_id)) {
    return `${card.local_id}/${String(card.set_total).padStart(card.local_id.length, "0")}`;
  }
  return card.local_id;
}

/** One card in a grid: image (or placeholder), name, number, set, series, rarity, colors. */
export function CardTile({ card, action }: { card: Card; action?: ReactNode }) {
  const group = card.rarity ? rarityGroup(card.rarity) : null;

  return (
    <div>
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

      <p className="mt-1 truncate text-sm font-medium" title={card.name}>
        {card.name}
      </p>
      <p className="truncate text-xs text-gray-500" title={`${cardNumber(card)} · ${card.set_name}`}>
        <span className="font-mono">{cardNumber(card)}</span> · {card.set_name}
      </p>
      {card.series && <p className="truncate text-xs text-gray-400">{card.series}</p>}

      <div className="mt-1 flex items-center gap-1">
        {card.rarity && group && (
          <span
            className="mr-1 max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: group.color }}
            title={card.rarity}
          >
            {rarityBadge(card.rarity)}
          </span>
        )}
        {card.colors.map((c) => (
          <span
            key={c}
            title={c}
            className="h-3 w-3 shrink-0 rounded-full border border-gray-600"
            style={{ background: SWATCH[c] }}
          />
        ))}
      </div>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

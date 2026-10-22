import type { ReactNode } from "react";
import { cardImage } from "@/lib/cardImage";

export type Card = {
  id: string;
  name: string;
  set_name: string | null;
  local_id: string | null;
  rarity: string | null;
  image_url: string | null;
  colors: string[];
};

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

/** One card in a grid: image (or placeholder), name, set, color dots, optional action button. */
export function CardTile({ card, action }: { card: Card; action?: ReactNode }) {
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
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Card images come from two places:
 *  - TCGdex: stored as a base URL; append /low.webp or /high.webp
 *  - pokemontcg.io (fallback for gallery subsets): stored as a full _hires.png URL
 */
export function cardImage(url: string | null, size: "low" | "high" = "low") {
  if (!url) return null;
  if (url.includes("images.pokemontcg.io")) {
    return size === "low" ? url.replace("_hires", "") : url;
  }
  return `${url}/${size}.webp`;
}
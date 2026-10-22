/**
 * Seed the `cards` table from TCGdex.
 *
 *   npx tsx scripts/seed-cards.ts --list            # print all set ids
 *   npx tsx scripts/seed-cards.ts <setId> [setId…]  # seed specific sets
 *   npx tsx scripts/seed-cards.ts --all             # every physical set (resumable)
 *   npx tsx scripts/seed-cards.ts --missing         # retry sets with cards lacking images
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Safe to re-run: rows are upserted by card id.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { Vibrant } from "node-vibrant/node";

const API = "https://api.tcgdex.net/v2/en";
const CONCURRENCY = 6; // be polite to a free API
const UPSERT_BATCH = 200;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ---------- TCGdex types (only the fields we use) ----------
type SetBrief = { id: string; name: string; cardCount?: { total: number } };
type CardBrief = { id: string; localId: string; name: string; image?: string };
type SetDetail = { id: string; name: string; cards: CardBrief[] };
type CardDetail = {
  id: string;
  localId: string;
  name: string;
  image?: string;
  rarity?: string;
  illustrator?: string;
  types?: string[];
  set: { id: string; name: string };
};

// ---------- helpers ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJSON<T>(url: string, tries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= tries) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    await sleep(1000 * attempt);
  }
}

/** Run fn over items with at most `limit` in flight. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------- colors ----------
/** Map a hex color to a coarse, human name used for theme matching. */
function colorName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;

  if (l < 0.15) return "black";
  if (l > 0.88 && s < 0.3) return "white";
  if (s < 0.18) return "gray";
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return l < 0.4 ? "brown" : "orange";
  if (h < 65) return "yellow";
  if (h < 160) return "green";
  if (h < 195) return "teal";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

/** TCGdex set ids that pokemontcg.io names differently. */
const PTCG_SET_OVERRIDES: Record<string, string> = {
  "swsh4.5sv": "swsh45sv", // Shining Fates Shiny Vault
  "sm7.5": "sm75", // Dragon Majesty
  "sm3.5": "sm35", // Shining Legends
  cel25cc: "cel25c", // Celebrations Classic Collection
  hgssp: "hsp", // HGSS promos
};

/**
 * TCGdex has no images for some cards (gallery subsets, older specials).
 * Build candidate URLs on pokemontcg.io's image CDN. The two sources name
 * sets and number cards slightly differently, so we try a few variants and
 * keep the first one that downloads.
 */
function fallbackImages(setId: string, localId: string): string[] {
  const setIds = new Set<string>([
    PTCG_SET_OVERRIDES[setId] ?? setId,
    setId.replace(".", "pt"), // swsh12.5gg -> swsh12pt5gg
    setId.replace(".", ""), // sm7.5 -> sm75
  ]);
  const mcd = setId.match(/^20(\d\d)/); // 2021swsh -> mcd21
  if (mcd) setIds.add(`mcd${mcd[1]}`);

  const localIds = new Set<string>([localId]);
  if (/^\d+$/.test(localId)) localIds.add(String(parseInt(localId, 10))); // "001" -> "1"

  const urls: string[] = [];
  for (const s of setIds) {
    for (const l of localIds) urls.push(`https://images.pokemontcg.io/${s}/${l}_hires.png`);
  }
  return urls;
}

/**
 * Download the card image, crop to the artwork window (so yellow/silver
 * borders and the text box don't dominate), and extract a palette.
 * Returns null if the image can't be downloaded.
 */
async function extractColors(imageUrl: string) {
  const res = await fetch(imageUrl);
  if (!res.ok) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  const img = sharp(buf);
  const { width = 0, height = 0 } = await img.metadata();

  // Art window of a standard card: roughly 8–92% wide, 11–53% tall.
  // Full-art cards are art everywhere, so this crop works for them too.
  const art = await img
    .extract({
      left: Math.round(width * 0.08),
      top: Math.round(height * 0.11),
      width: Math.round(width * 0.84),
      height: Math.round(height * 0.42),
    })
    .png()
    .toBuffer();

  const palette = await Vibrant.from(art).getPalette();
  const swatches = Object.values(palette)
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => b.population - a.population);

  const hexes = swatches.map((s) => s.hex);
  const colors = [...new Set(hexes.map(colorName))].slice(0, 3);
  return { palette: hexes, colors };
}

// ---------- seeding ----------
async function listSets() {
  const sets = await getJSON<SetBrief[]>(`${API}/sets`);
  for (const s of sets) {
    console.log(`${s.id.padEnd(16)} ${s.name}  (${s.cardCount?.total ?? "?"} cards)`);
  }
  console.log(`\n${sets.length} sets. Pass ids to seed, e.g. npx tsx scripts/seed-cards.ts <id>`);
}

async function seedSet(setId: string) {
  const set = await getJSON<SetDetail>(`${API}/sets/${encodeURIComponent(setId)}`);
  console.log(`\n▶ ${set.name} (${set.id}): ${set.cards.length} cards`);

  let done = 0;
  const rows = await mapPool(set.cards, CONCURRENCY, async (brief) => {
    try {
      const card = await getJSON<CardDetail>(`${API}/cards/${encodeURIComponent(brief.id)}`);
      // Prefer TCGdex's image; otherwise try the pokemontcg.io CDN.
      const tcgdexBase = card.image ?? brief.image;
      const candidates = tcgdexBase
        ? [`${tcgdexBase}/high.webp`]
        : fallbackImages(card.set.id, card.localId);

      let extracted: Awaited<ReturnType<typeof extractColors>> = null;
      let foundUrl: string | null = null;
      for (const url of candidates) {
        extracted = await extractColors(url);
        if (extracted) {
          foundUrl = url;
          break;
        }
      }
      const palette = extracted?.palette ?? [];
      const colors = extracted?.colors ?? [];

      // Stored value: a TCGdex base URL (app appends /low.webp or /high.webp)
      // or a full pokemontcg.io URL. lib/cardImage.ts handles both.
      const imageUrl = tcgdexBase ?? foundUrl;

      done++;
      if (done % 25 === 0) console.log(`  ${done}/${set.cards.length}`);

      return {
        id: card.id,
        name: card.name,
        set_id: card.set.id,
        set_name: card.set.name,
        local_id: card.localId,
        rarity: card.rarity ?? null,
        illustrator: card.illustrator ?? null,
        types: card.types ?? [],
        image_url: imageUrl,
        colors,
        palette,
        updated_at: new Date().toISOString(),
      };
    } catch (err) {
      console.warn(`  ✗ ${brief.id}: ${(err as Error).message}`);
      return null;
    }
  });

  const valid = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  for (let i = 0; i < valid.length; i += UPSERT_BATCH) {
    const chunk = valid.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase.from("cards").upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`Upsert failed for ${set.id}: ${error.message}`);
  }
  console.log(`✓ ${set.name}: saved ${valid.length}/${set.cards.length}`);
}

/** TCG Pocket (digital-only) sets: A1, A2a, B1, P-A, … */
const isPocketSet = (id: string) => /^(A\d|B\d|P-A)/.test(id);

/** How many cards of this set are already in the database. */
async function savedCount(setId: string) {
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("set_id", setId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Seed every physical set. Sets that are already complete are skipped,
 * so you can stop with Ctrl+C and re-run to resume where you left off.
 */
async function seedAll() {
  const sets = (await getJSON<SetBrief[]>(`${API}/sets`)).filter((s) => !isPocketSet(s.id));
  console.log(`${sets.length} physical sets to check.`);

  const failed: string[] = [];
  for (const [i, s] of sets.entries()) {
    const total = s.cardCount?.total ?? 0;
    const have = await savedCount(s.id);
    if (total > 0 && have >= total) {
      console.log(`[${i + 1}/${sets.length}] skip ${s.id} (${have}/${total} already saved)`);
      continue;
    }
    console.log(`[${i + 1}/${sets.length}] ${s.id}`);
    try {
      await seedSet(s.id);
    } catch (err) {
      console.warn(`✗ ${s.id}: ${(err as Error).message}`);
      failed.push(s.id);
    }
  }
  console.log(failed.length ? `\nFailed sets (re-run to retry): ${failed.join(" ")}` : "\nAll sets done.");
}

/**
 * Re-seed only the sets that still have cards without images.
 * Useful later: TCGdex keeps adding images for new and niche sets.
 */
async function seedMissing() {
  const setIds = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cards")
      .select("set_id")
      .is("image_url", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    data.forEach((r) => r.set_id && setIds.add(r.set_id));
    if (data.length < 1000) break;
  }
  if (setIds.size === 0) {
    console.log("Every card has an image.");
    return;
  }
  console.log(`Sets with missing images: ${[...setIds].join(" ")}`);
  for (const id of setIds) {
    try {
      await seedSet(id);
    } catch (err) {
      console.warn(`✗ ${id}: ${(err as Error).message}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--list") {
    await listSets();
    return;
  }
  if (args[0] === "--missing") {
    await seedMissing();
    return;
  }
  if (args[0] === "--all") {
    await seedAll();
    return;
  }
  for (const setId of args) {
    await seedSet(setId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
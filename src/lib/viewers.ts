// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn profil viewerlarını çeken modül.
// Kaynak seçenekleri:
//   1. VIEWER_SOURCE=file  → local JSON dosyasından oku (en basit)
//   2. VIEWER_SOURCE=api   → başka bir API'dan çek
//   3. VIEWER_SOURCE=heyreach → Heyreach'in viewer verisi varsa
//
// JSON dosyası formatı: ["https://linkedin.com/in/abc", "https://linkedin.com/in/xyz"]
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEWER_SOURCE = (process.env.VIEWER_SOURCE ?? "file") as "file" | "api";
const VIEWER_FILE_PATH = process.env.VIEWER_FILE_PATH ?? "./viewers.json";
const VIEWER_API_URL = process.env.VIEWER_API_URL ?? "";
const VIEWER_API_KEY = process.env.VIEWER_API_KEY ?? "";

// Daha önce işlenmiş URL'leri takip et (aynı kişiye 2 kez mesaj gitmesin)
const PROCESSED_CACHE_PATH = process.env.PROCESSED_CACHE_PATH ?? "./processed.json";

function loadProcessedCache(): Set<string> {
  try {
    const data = readFileSync(resolve(PROCESSED_CACHE_PATH), "utf8");
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

import { writeFileSync } from "node:fs";

export function markAsProcessed(profileUrls: string[]): void {
  const cache = loadProcessedCache();
  profileUrls.forEach((u) => cache.add(u));
  writeFileSync(resolve(PROCESSED_CACHE_PATH), JSON.stringify([...cache], null, 2));
}

// ─── Viewer URL listesini al ─────────────────────────────────────────────────
export async function getViewerProfileUrls(): Promise<string[]> {
  let allUrls: string[] = [];

  if (VIEWER_SOURCE === "file") {
    const raw = readFileSync(resolve(VIEWER_FILE_PATH), "utf8");
    allUrls = JSON.parse(raw) as string[];
  } else if (VIEWER_SOURCE === "api") {
    const res = await fetch(VIEWER_API_URL, {
      headers: VIEWER_API_KEY ? { Authorization: `Bearer ${VIEWER_API_KEY}` } : {},
    });
    if (!res.ok) throw new Error(`Viewer API hatası: ${res.status}`);
    const data = await res.json() as { url?: string; profileUrl?: string }[];
    allUrls = data.map((d) => d.url ?? d.profileUrl ?? "").filter(Boolean);
  }

  // Zaten işlenmiş kişileri filtrele
  const processed = loadProcessedCache();
  return allUrls.filter((url) => !processed.has(url));
}

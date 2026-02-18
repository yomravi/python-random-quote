// ─────────────────────────────────────────────────────────────────────────────
// Kendi realtime scraper API'n için adapter.
// SCRAPER_API_URL ve SCRAPER_API_KEY env değişkenlerini set et.
//
// Beklenen response formatı aşağıdaki gibi ya da mapProfile() içinde uyarla.
// ─────────────────────────────────────────────────────────────────────────────

const SCRAPER_API_URL = process.env.SCRAPER_API_URL!;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY ?? "";

export interface LinkedInProfile {
  profileUrl: string;
  fullName: string;
  headline: string;
  jobTitle: string;
  company: string;
  companySize?: string;
  industry?: string;
  location: string;
  about?: string;
}

// ─── Scraper API'nın döndürdüğü raw response'u burada map'le ────────────────
// API'na göre field isimlerini düzenle
function mapProfile(raw: Record<string, unknown>, profileUrl: string): LinkedInProfile {
  return {
    profileUrl,
    fullName:
      (raw["fullName"] as string) ??
      `${raw["firstName"] ?? ""} ${raw["lastName"] ?? ""}`.trim(),
    headline: (raw["headline"] as string) ?? "",
    jobTitle:
      (raw["title"] as string) ??
      (raw["jobTitle"] as string) ??
      (raw["position"] as string) ?? "",
    company:
      (raw["company"] as string) ??
      (raw["currentCompany"] as string) ??
      (raw["companyName"] as string) ?? "",
    companySize:
      (raw["companySize"] as string) ??
      (raw["employeeCount"] as string) ?? undefined,
    industry: (raw["industry"] as string) ?? undefined,
    location:
      (raw["location"] as string) ??
      (raw["geoRegion"] as string) ?? "",
    about:
      (raw["about"] as string) ??
      (raw["summary"] as string) ?? undefined,
  };
}

// ─── Tek profil URL → profil detayları ──────────────────────────────────────
export async function scrapeProfile(profileUrl: string): Promise<LinkedInProfile | null> {
  try {
    const res = await fetch(SCRAPER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SCRAPER_API_KEY ? { Authorization: `Bearer ${SCRAPER_API_KEY}` } : {}),
      },
      body: JSON.stringify({ url: profileUrl }),
    });

    if (!res.ok) {
      console.error(`Scraper API hatası (${res.status}) — ${profileUrl}`);
      return null;
    }

    const data = await res.json() as Record<string, unknown>;
    return mapProfile(data, profileUrl);
  } catch (err) {
    console.error(`Scraper fetch hatası — ${profileUrl}:`, err);
    return null;
  }
}

// ─── Toplu çekme: URL listesi → profil listesi ───────────────────────────────
// Concurrent limiti ayarlayabilirsin (default: 5 eş zamanlı istek)
export async function scrapeProfiles(
  profileUrls: string[],
  concurrency = 5
): Promise<LinkedInProfile[]> {
  const results: LinkedInProfile[] = [];

  for (let i = 0; i < profileUrls.length; i += concurrency) {
    const batch = profileUrls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(scrapeProfile));
    results.push(...batchResults.filter(Boolean) as LinkedInProfile[]);

    if (i + concurrency < profileUrls.length) {
      // API rate limit için kısa bekleme
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

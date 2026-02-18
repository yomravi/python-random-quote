import type { LinkedInProfile } from "./scraper.js";

// ─────────────────────────────────────────────────────────────────────────────
// Claude Code CLI'yi subprocess olarak çağırır.
// Bu sayede Anthropic API parası ödemeden subscription token'ını kullanırsın.
//
// Ön koşul: sistemde `claude` CLI kurulu ve login olmuş olmalı
//   npm install -g @anthropic-ai/claude-code
//   claude login
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ICP_CONFIG = {
  targetTitles: (process.env.ICP_TARGET_TITLES ?? "Founder,Co-Founder,CEO,CTO,Head of Growth").split(","),
  targetIndustries: (process.env.ICP_TARGET_INDUSTRIES ?? "SaaS,Software,Technology").split(","),
  targetLocations: (process.env.ICP_TARGET_LOCATIONS ?? "Turkey,Germany,United Kingdom").split(","),
  companySizeMin: parseInt(process.env.ICP_COMPANY_SIZE_MIN ?? "10"),
  companySizeMax: parseInt(process.env.ICP_COMPANY_SIZE_MAX ?? "500"),
};

export interface ICPResult {
  isICP: boolean;
  score: number; // 0-100
  reasons: string[];
  suggestedTemplate: "cold_intro" | "value_prop" | "partnership" | "skip";
}

export async function checkICP(profile: LinkedInProfile): Promise<ICPResult> {
  const prompt = `
Sen bir B2B satış uzmanısın. Aşağıdaki LinkedIn profilini değerlendirip ICP uyumunu belirle.

ICP KRİTERLERİ:
- Hedef Unvanlar: ${ICP_CONFIG.targetTitles.join(", ")}
- Hedef Sektörler: ${ICP_CONFIG.targetIndustries.join(", ")}
- Hedef Lokasyonlar: ${ICP_CONFIG.targetLocations.join(", ")}
- Şirket Büyüklüğü: ${ICP_CONFIG.companySizeMin}-${ICP_CONFIG.companySizeMax} çalışan

PROFİL:
İsim: ${profile.fullName}
Unvan: ${profile.jobTitle}
Headline: ${profile.headline}
Şirket: ${profile.company}
Şirket Büyüklüğü: ${profile.companySize ?? "bilinmiyor"}
Sektör: ${profile.industry ?? "bilinmiyor"}
Lokasyon: ${profile.location}
Hakkında: ${profile.about ?? "yok"}

SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma:
{"isICP":true/false,"score":0-100,"reasons":["sebep1","sebep2"],"suggestedTemplate":"cold_intro"/"value_prop"/"partnership"/"skip"}

suggestedTemplate: cold_intro(60-74), value_prop(75-89), partnership(90+), skip(ICP değil)
`.trim();

  try {
    // claude -p = non-interactive / print mode, subscription token'ı kullanır
    const { stdout } = await execFileAsync("claude", ["-p", prompt], {
      timeout: 30_000,
      env: { ...process.env, NO_COLOR: "1" },
    });

    // Stdout'ta sadece JSON olmasını bekliyoruz
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON bulunamadı: " + stdout.slice(0, 200));

    const result = JSON.parse(jsonMatch[0]);
    return {
      isICP: result.isICP ?? false,
      score: result.score ?? 0,
      reasons: result.reasons ?? [],
      suggestedTemplate: result.suggestedTemplate ?? "skip",
    };
  } catch (err) {
    console.error("Claude Code CLI hatası:", err);
    return { isICP: false, score: 0, reasons: ["CLI error"], suggestedTemplate: "skip" };
  }
}

import Anthropic from "@anthropic-ai/sdk";
import type { LinkedInProfile } from "./apify.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── ICP Kriterlerini buradan düzenle ───────────────────────────────────────
const ICP_CRITERIA = {
  targetTitles: process.env.ICP_TARGET_TITLES?.split(",") || [
    "Founder",
    "Co-Founder",
    "CEO",
    "CTO",
    "Head of Growth",
    "VP of Sales",
    "Director of Marketing",
  ],
  targetIndustries: process.env.ICP_TARGET_INDUSTRIES?.split(",") || [
    "SaaS",
    "Software",
    "Technology",
    "E-commerce",
    "Fintech",
  ],
  targetLocations: process.env.ICP_TARGET_LOCATIONS?.split(",") || [
    "Turkey",
    "Germany",
    "United Kingdom",
    "United States",
  ],
  companySizeMin: parseInt(process.env.ICP_COMPANY_SIZE_MIN || "10"),
  companySizeMax: parseInt(process.env.ICP_COMPANY_SIZE_MAX || "1000"),
};

export interface ICPResult {
  isICP: boolean;
  score: number; // 0-100
  reasons: string[];
  suggestedTemplate: "cold_intro" | "value_prop" | "partnership" | "skip";
}

export async function checkICP(profile: LinkedInProfile): Promise<ICPResult> {
  const systemPrompt = `Sen bir B2B satış uzmanısın. LinkedIn profillerini değerlendirip ICP (Ideal Customer Profile) uyumunu analiz ediyorsun.

ICP KRİTERLERİ:
- Hedef Unvanlar: ${ICP_CRITERIA.targetTitles.join(", ")}
- Hedef Sektörler: ${ICP_CRITERIA.targetIndustries.join(", ")}
- Hedef Lokasyonlar: ${ICP_CRITERIA.targetLocations.join(", ")}
- Şirket Büyüklüğü: ${ICP_CRITERIA.companySizeMin}-${ICP_CRITERIA.companySizeMax} çalışan

Yanıtını SADECE JSON formatında ver, başka metin ekleme.`;

  const userPrompt = `Şu profili değerlendir:

İsim: ${profile.fullName}
Unvan: ${profile.jobTitle}
Headline: ${profile.headline}
Şirket: ${profile.company}
Şirket Büyüklüğü: ${profile.companySize || "bilinmiyor"}
Sektör: ${profile.industry || "bilinmiyor"}
Lokasyon: ${profile.location}
Hakkında: ${profile.about || "yok"}

JSON formatında yanıt ver:
{
  "isICP": boolean,
  "score": number (0-100),
  "reasons": ["sebep1", "sebep2"],
  "suggestedTemplate": "cold_intro" | "value_prop" | "partnership" | "skip"
}

suggestedTemplate seçim kriterleri:
- cold_intro: ICP uyumlu, soğuk intro uygun (score 60-74)
- value_prop: Güçlü ICP uyumu, değer odaklı mesaj (score 75-89)
- partnership: Çok güçlü uyum, partnership angle (score 90+)
- skip: ICP değil`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [
      { role: "user", content: userPrompt },
    ],
    system: systemPrompt,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    const result = JSON.parse(text.trim());
    return {
      isICP: result.isICP ?? false,
      score: result.score ?? 0,
      reasons: result.reasons ?? [],
      suggestedTemplate: result.suggestedTemplate ?? "skip",
    };
  } catch {
    console.error("Claude yanıtı parse edilemedi:", text);
    return { isICP: false, score: 0, reasons: ["Parse error"], suggestedTemplate: "skip" };
  }
}

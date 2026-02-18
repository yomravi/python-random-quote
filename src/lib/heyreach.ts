import type { LinkedInProfile } from "./apify.js";
import type { ICPResult } from "./icp-agent.js";

const HEYREACH_API_KEY = process.env.HEYREACH_API_KEY!;
const HEYREACH_BASE_URL = "https://api.heyreach.io/api/public";

// Campaign ID'leri Heyreach dashboard'dan al
const CAMPAIGN_IDS = {
  cold_intro: process.env.HEYREACH_CAMPAIGN_COLD_INTRO!,
  value_prop: process.env.HEYREACH_CAMPAIGN_VALUE_PROP!,
  partnership: process.env.HEYREACH_CAMPAIGN_PARTNERSHIP!,
};

async function heyreachFetch(endpoint: string, body: unknown) {
  const response = await fetch(`${HEYREACH_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": HEYREACH_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Heyreach API error ${response.status}: ${error}`);
  }

  return response.json();
}

export interface HeyreachResult {
  success: boolean;
  leadId?: string;
  campaignId?: string;
  error?: string;
}

export async function addLeadToCampaign(
  profile: LinkedInProfile,
  icpResult: ICPResult
): Promise<HeyreachResult> {
  if (icpResult.suggestedTemplate === "skip") {
    return { success: false, error: "ICP değil, skip" };
  }

  const campaignId = CAMPAIGN_IDS[icpResult.suggestedTemplate];
  if (!campaignId) {
    throw new Error(`Campaign ID bulunamadı: ${icpResult.suggestedTemplate}`);
  }

  try {
    // Heyreach'e lead ekle + kampanyaya ata (tek API call)
    const result = await heyreachFetch("/v2/lead/AddLeadToList", {
      campaignId,
      leads: [
        {
          linkedInProfileLink: profile.profileUrl,
          firstName: profile.fullName.split(" ")[0],
          lastName: profile.fullName.split(" ").slice(1).join(" "),
          companyName: profile.company,
          position: profile.jobTitle,
          location: profile.location,
          // Custom variables — template'lerde {{customVar1}} şeklinde kullan
          customVar1: icpResult.score.toString(),
          customVar2: icpResult.reasons[0] || "",
        },
      ],
    });

    return {
      success: true,
      leadId: result?.leadIds?.[0],
      campaignId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

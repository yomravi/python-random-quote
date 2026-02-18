import { ApifyClient } from "@apify/client";

export interface LinkedInProfile {
  profileUrl: string;
  fullName: string;
  headline: string;
  jobTitle: string;
  company: string;
  companySize?: string;
  industry?: string;
  location: string;
  connectionDegree?: string;
  about?: string;
}

// Sales Navigator search URL'ini buraya koy
// örn: https://www.linkedin.com/sales/search/people?query=...
const SALES_NAV_SEARCH_URL = process.env.LINKEDIN_SEARCH_URL!;
const APIFY_TOKEN = process.env.APIFY_TOKEN!;

export async function scrapeLinkedInProfiles(): Promise<LinkedInProfile[]> {
  const client = new ApifyClient({ token: APIFY_TOKEN });

  // Sales Navigator Scraper — Apify'da en güvenilir LinkedIn aktörü
  // Actor: "curious_coder/linkedin-sales-navigator-scraper"
  // Alternatif: "dev_ffu/linkedin-profile-scraper" (normal LinkedIn)
  const run = await client.actor("curious_coder/linkedin-sales-navigator-scraper").call({
    searchUrl: SALES_NAV_SEARCH_URL,
    maxResults: parseInt(process.env.MAX_PROFILES_PER_RUN || "50"),
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
    },
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items.map((item: any) => ({
    profileUrl: item.profileUrl || item.url,
    fullName: item.fullName || `${item.firstName} ${item.lastName}`,
    headline: item.headline || "",
    jobTitle: item.title || item.jobTitle || "",
    company: item.company || item.currentCompany || "",
    companySize: item.companySize || "",
    industry: item.industry || "",
    location: item.location || item.geoRegion || "",
    connectionDegree: item.connectionDegree || "",
    about: item.about || item.summary || "",
  }));
}

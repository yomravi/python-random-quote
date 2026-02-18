import { schedules, logger } from "@trigger.dev/sdk/v3";
import { scrapeLinkedInProfiles } from "../lib/apify.js";
import { checkICP } from "../lib/icp-agent.js";
import { addLeadToCampaign } from "../lib/heyreach.js";

export const linkedinICPJob = schedules.task({
  id: "linkedin-icp-daily",
  // Her gün sabah 09:00 (UTC+3 için 06:00 UTC)
  cron: "0 6 * * *",
  maxDuration: 300,

  run: async () => {
    logger.info("LinkedIn ICP automation başladı");

    // 1. LinkedIn'den profilleri çek
    logger.info("Apify ile LinkedIn profilleri çekiliyor...");
    const profiles = await scrapeLinkedInProfiles();
    logger.info(`${profiles.length} profil çekildi`);

    const results = {
      total: profiles.length,
      icpMatch: 0,
      addedToHeyreach: 0,
      failed: 0,
      skipped: 0,
    };

    // 2. Her profili Claude ile ICP check et
    for (const profile of profiles) {
      try {
        logger.info(`ICP check: ${profile.fullName} @ ${profile.company}`);

        const icpResult = await checkICP(profile);

        if (!icpResult.isICP || icpResult.suggestedTemplate === "skip") {
          logger.info(`Skip: ${profile.fullName} (score: ${icpResult.score})`);
          results.skipped++;
          continue;
        }

        results.icpMatch++;
        logger.info(
          `ICP MATCH: ${profile.fullName} | Score: ${icpResult.score} | Template: ${icpResult.suggestedTemplate}`,
          { reasons: icpResult.reasons }
        );

        // 3. Heyreach'e ekle
        const heyreachResult = await addLeadToCampaign(profile, icpResult);

        if (heyreachResult.success) {
          results.addedToHeyreach++;
          logger.info(`Heyreach'e eklendi: ${profile.fullName} → Campaign ${heyreachResult.campaignId}`);
        } else {
          results.failed++;
          logger.error(`Heyreach hatası: ${profile.fullName}`, { error: heyreachResult.error });
        }

        // Rate limiting — Heyreach ve Claude API'yi zorlamayalım
        await new Promise((r) => setTimeout(r, 1500));
      } catch (error) {
        results.failed++;
        logger.error(`Hata: ${profile.fullName}`, { error });
      }
    }

    // 4. Özet log
    logger.info("Günlük run tamamlandı", results);

    return results;
  },
});

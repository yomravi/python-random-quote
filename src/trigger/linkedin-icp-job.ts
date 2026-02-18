import { schedules, logger } from "@trigger.dev/sdk/v3";
import { getViewerProfileUrls, markAsProcessed } from "../lib/viewers.js";
import { scrapeProfiles } from "../lib/scraper.js";
import { checkICP } from "../lib/icp-agent.js";
import { addLeadToCampaign } from "../lib/heyreach.js";

export const linkedinICPJob = schedules.task({
  id: "linkedin-icp-daily",
  cron: "0 6 * * *", // Her gün 09:00 TR (06:00 UTC)
  maxDuration: 300,

  run: async () => {
    logger.info("LinkedIn ICP automation başladı");

    // 1. Profil viewerlarının URL listesini al (daha önce işlenenleri hariç)
    const viewerUrls = await getViewerProfileUrls();
    logger.info(`${viewerUrls.length} yeni viewer URL bulundu`);

    if (viewerUrls.length === 0) {
      logger.info("Yeni viewer yok, run tamamlandı.");
      return { total: 0, icpMatch: 0, addedToHeyreach: 0 };
    }

    // 2. Scraper API ile profil detaylarını çek
    logger.info("Profiller scrape ediliyor...");
    const profiles = await scrapeProfiles(viewerUrls);
    logger.info(`${profiles.length} profil scrape edildi`);

    const results = {
      total: profiles.length,
      icpMatch: 0,
      addedToHeyreach: 0,
      failed: 0,
      skipped: 0,
    };
    const processedUrls: string[] = [];

    // 3. Her profili Claude Code CLI ile ICP check et
    for (const profile of profiles) {
      try {
        logger.info(`ICP check: ${profile.fullName} @ ${profile.company}`);

        const icpResult = await checkICP(profile);

        if (!icpResult.isICP || icpResult.suggestedTemplate === "skip") {
          logger.info(`Skip: ${profile.fullName} — score: ${icpResult.score}`);
          results.skipped++;
          processedUrls.push(profile.profileUrl);
          continue;
        }

        results.icpMatch++;
        logger.info(
          `ICP MATCH: ${profile.fullName} | Score: ${icpResult.score} | ${icpResult.suggestedTemplate}`,
          { reasons: icpResult.reasons }
        );

        // 4. Heyreach kampanyasına ekle
        const heyreachResult = await addLeadToCampaign(profile, icpResult);

        if (heyreachResult.success) {
          results.addedToHeyreach++;
          logger.info(`Heyreach'e eklendi: ${profile.fullName}`);
        } else {
          results.failed++;
          logger.error(`Heyreach hatası: ${profile.fullName}`, { error: heyreachResult.error });
        }

        processedUrls.push(profile.profileUrl);

        // Claude Code CLI çağrıları arasında bekle (rate limit)
        await new Promise((r) => setTimeout(r, 2000));
      } catch (error) {
        results.failed++;
        logger.error(`Hata: ${profile.fullName}`, { error });
      }
    }

    // 5. İşlenenleri cache'e yaz (tekrar mesaj gitmesin)
    markAsProcessed(processedUrls);

    logger.info("Günlük run tamamlandı", results);
    return results;
  },
});

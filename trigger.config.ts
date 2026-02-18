import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "linkedin-icp-automation", // trigger.dev dashboard'dan al
  dirs: ["./src/trigger"],
  maxDuration: 300, // 5 dakika max (Apify + Claude süresi için)
});

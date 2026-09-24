import "dotenv/config";
import cron from "node-cron";
import { app } from "./app.js";
import { pollAllSources } from "./lib/pipeline.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Gig Finder dashboard running at http://localhost:${PORT}`);
  console.log("Note: this in-process cron only runs while this process stays alive.");
  console.log("For always-on use, run this under pm2 (see README) or deploy to Vercel instead.");

  const cronExpr = process.env.POLL_CRON || "0 */3 * * *";
  if (cron.validate(cronExpr)) {
    cron.schedule(cronExpr, () => {
      console.log("[cron] Running scheduled poll...");
      pollAllSources().catch((err) => console.error("[cron] Poll failed:", err));
    });
    console.log(`Auto-poll scheduled: "${cronExpr}"`);
  } else {
    console.warn(`Invalid POLL_CRON "${cronExpr}" — auto-poll disabled.`);
  }
});

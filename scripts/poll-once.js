import "dotenv/config";
import { pollAllSources } from "../lib/pipeline.js";

pollAllSources()
  .then((result) => {
    console.log("Poll finished:", result);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Poll failed:", err);
    process.exit(1);
  });

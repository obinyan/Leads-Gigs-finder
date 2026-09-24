import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";

import { getAllLeads, getLead, updateLead, deleteLead } from "./lib/store.js";
import { pollAllSources, scoreAndMaybeDraft, ingestManualLead } from "./lib/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- API routes ---

app.get("/api/leads", async (req, res) => {
  res.json(await getAllLeads());
});

// Accepts both POST (dashboard button, GitHub Actions) and GET (Vercel's own
// cron always sends GET) so both triggering paths work against one route.
app.all("/api/poll", async (req, res) => {
  try {
    const result = await pollAllSources();
    res.json(result);
  } catch (err) {
    console.error("[poll] failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/leads/:id/rescore", async (req, res) => {
  await scoreAndMaybeDraft(req.params.id);
  res.json(await getLead(req.params.id));
});

app.post("/api/leads/:id/status", async (req, res) => {
  const updated = await updateLead(req.params.id, { status: req.body.status });
  if (!updated) return res.status(404).json({ error: "Lead not found" });
  res.json(updated);
});

app.delete("/api/leads/:id", async (req, res) => {
  await deleteLead(req.params.id);
  res.json({ deleted: true });
});

// Manual ingestion — for leads you spot yourself on Facebook, Threads, X, etc.
app.post("/api/ingest", async (req, res) => {
  const { title, description, sourceUrl, budget, source } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const lead = await ingestManualLead({ title, description, sourceUrl, budget, source });
  if (!lead) return res.status(409).json({ error: "Duplicate lead (same sourceUrl already exists)" });
  await scoreAndMaybeDraft(lead.id);
  res.json(await getLead(lead.id));
});

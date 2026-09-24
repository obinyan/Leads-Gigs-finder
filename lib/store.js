import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";

const LEADS_KEY = "gig-finder:leads";
// Vercel KV itself was discontinued — the current path is an Upstash Redis
// integration from the Vercel Marketplace, which injects these two vars.
const USE_KV = Boolean(process.env.UPSTASH_REDIS_REST_URL);

// Only import @upstash/redis when it's actually configured — keeps local dev
// from needing a Redis database at all.
let redis;
if (USE_KV) {
  const { Redis } = await import("@upstash/redis");
  redis = Redis.fromEnv();
}

const DB_PATH = new URL("../data/leads.json", import.meta.url);

function loadFromFile() {
  if (!existsSync(DB_PATH)) return [];
  try {
    return JSON.parse(readFileSync(DB_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveToFile(leads) {
  writeFileSync(DB_PATH, JSON.stringify(leads, null, 2));
}

async function loadAll() {
  if (USE_KV) return (await redis.get(LEADS_KEY)) || [];
  return loadFromFile();
}

async function saveAll(leads) {
  if (USE_KV) {
    await redis.set(LEADS_KEY, leads);
    return;
  }
  saveToFile(leads);
}

export async function getAllLeads() {
  const leads = await loadAll();
  return leads.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

export async function getLead(id) {
  const leads = await loadAll();
  return leads.find((l) => l.id === id);
}

// Adds a lead if its sourceUrl isn't already present (dedupe across polls).
export async function addLead(lead) {
  const leads = await loadAll();
  if (leads.some((l) => l.sourceUrl === lead.sourceUrl)) return null;
  const newLead = {
    id: randomUUID(),
    status: "new",
    score: null,
    scoreReason: null,
    draftProposal: null,
    createdAt: new Date().toISOString(),
    ...lead
  };
  leads.push(newLead);
  await saveAll(leads);
  return newLead;
}

export async function updateLead(id, patch) {
  const leads = await loadAll();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...patch };
  await saveAll(leads);
  return leads[idx];
}

export async function deleteLead(id) {
  const leads = (await loadAll()).filter((l) => l.id !== id);
  await saveAll(leads);
}

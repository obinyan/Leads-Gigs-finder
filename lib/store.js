import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";

const LEADS_KEY = "gig-finder:leads";
const FREELANCER_TOKENS_KEY = "gig-finder:freelancer-tokens";
// Vercel KV itself was discontinued — the current path is an Upstash Redis
// integration from the Vercel Marketplace, which injects these two vars.
const USE_KV = Boolean(process.env.UPSTASH_REDIS_REST_URL);

// Lazily constructed, not at module load time. A crash while constructing
// the client (e.g. only one of the two required env vars is actually set)
// used to happen at import time, which took down every route in the app,
// not just the one that needed Redis. Constructing it lazily on first real
// use means a misconfiguration only fails the specific request that needed
// it, and fails with a clear error message instead of a blank crash.
let redisClient;
let redisInitError;
function getRedis() {
  if (redisClient) return redisClient;
  if (redisInitError) throw redisInitError;
  try {
    redisClient = Redis.fromEnv();
    return redisClient;
  } catch (err) {
    redisInitError = new Error(
      `Upstash Redis is misconfigured — check that both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set in Vercel's Environment Variables. Original error: ${err.message}`
    );
    throw redisInitError;
  }
}

const LEADS_PATH = new URL("../data/leads.json", import.meta.url);
const FREELANCER_TOKENS_PATH = new URL("../data/freelancer-tokens.json", import.meta.url);

function loadJsonFile(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function saveJsonFile(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function loadAll() {
  if (USE_KV) return (await getRedis().get(LEADS_KEY)) || [];
  return loadJsonFile(LEADS_PATH, []);
}

async function saveAll(leads) {
  if (USE_KV) {
    await getRedis().set(LEADS_KEY, leads);
    return;
  }
  saveJsonFile(LEADS_PATH, leads);
}

// --- Freelancer OAuth tokens (access + refresh), same storage mechanism ---
// as leads: Redis in production, a local JSON file for local dev. This is
// what lets lib/freelancerAuth.js refresh the access token and have the new
// one persist across serverless invocations instead of being lost.

export async function getFreelancerTokens() {
  if (USE_KV) return (await getRedis().get(FREELANCER_TOKENS_KEY)) || null;
  return loadJsonFile(FREELANCER_TOKENS_PATH, null);
}

export async function saveFreelancerTokens(tokens) {
  if (USE_KV) {
    await getRedis().set(FREELANCER_TOKENS_KEY, tokens);
    return;
  }
  saveJsonFile(FREELANCER_TOKENS_PATH, tokens);
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

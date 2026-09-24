import { fetchFreelancerLeads } from "./freelancer.js";
import { fetchGoogleLeads } from "./googleSearch.js";
import { scoreLead, draftProposal } from "./claude.js";
import { addLead, updateLead, getAllLeads } from "./store.js";
import { profile, searchConfig } from "../config.js";

// Leads scoring at or above this are worth drafting a proposal for automatically.
const AUTO_DRAFT_THRESHOLD = 60;

export async function pollAllSources() {
  const found = [];

  const freelancerLeads = await fetchFreelancerLeads(searchConfig.freelancerQuery);
  found.push(...freelancerLeads);

  for (const q of searchConfig.googleQueries) {
    const leads = await fetchGoogleLeads(q);
    found.push(...leads);
  }

  const newLeads = [];
  for (const lead of found) {
    const added = await addLead(lead);
    if (added) newLeads.push(added);
  }

  console.log(`[pipeline] Poll complete: ${found.length} fetched, ${newLeads.length} new.`);

  for (const lead of newLeads) {
    await scoreAndMaybeDraft(lead.id);
  }

  return { fetched: found.length, added: newLeads.length };
}

export async function scoreAndMaybeDraft(leadId) {
  const leads = await getAllLeads();
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) return null;

  try {
    const { score, reason, reject } = await scoreLead(lead, profile);
    let patch = {
      score,
      scoreReason: reason,
      status: reject ? "rejected" : "scored"
    };
    await updateLead(leadId, patch);

    if (!reject && score >= AUTO_DRAFT_THRESHOLD) {
      const draft = await draftProposal(lead, profile);
      await updateLead(leadId, { draftProposal: draft, status: "drafted" });
    }
  } catch (err) {
    console.error(`[pipeline] Failed to score/draft lead ${leadId}:`, err.message);
    await updateLead(leadId, { status: "error", scoreReason: err.message });
  }
}

// Manual ingestion path for leads you spot yourself on Facebook, Threads,
// X/Twitter, or anywhere else with no API access — see README for why those
// platforms aren't polled automatically.
export async function ingestManualLead({ title, description, sourceUrl, budget, source }) {
  const lead = await addLead({
    source: source || "manual",
    title,
    description,
    sourceUrl: sourceUrl || `manual-${Date.now()}`,
    budget: budget || "not specified",
    postedAt: new Date().toISOString()
  });
  return lead;
}

// Freelancer.com API docs: https://developers.freelancer.com/docs
// Uses an OAuth access token that's refreshed automatically (see
// lib/freelancerAuth.js) — requires FREELANCER_CLIENT_ID,
// FREELANCER_CLIENT_SECRET, and FREELANCER_REFRESH_TOKEN in .env.

import { getValidFreelancerAccessToken } from "./freelancerAuth.js";

const API_BASE = "https://www.freelancer.com/api/projects/0.1/projects/active";

async function callFreelancerApi(query, token) {
  const params = new URLSearchParams({
    query,
    limit: "20",
    full_description: "true",
    job_details: "true"
  });

  return fetch(`${API_BASE}?${params.toString()}`, {
    headers: { "Freelancer-OAuth-V1": token }
  });
}

export async function fetchFreelancerLeads(query) {
  let token;
  try {
    token = await getValidFreelancerAccessToken();
  } catch (err) {
    console.warn(`[freelancer] Skipping this source — ${err.message}`);
    return [];
  }

  let res = await callFreelancerApi(query, token);

  // Token might have just been revoked rather than expired on schedule —
  // force one refresh and retry before giving up.
  if (res.status === 401) {
    console.warn("[freelancer] Got 401 with a token that looked valid — forcing a refresh and retrying once.");
    token = await getValidFreelancerAccessToken();
    res = await callFreelancerApi(query, token);
  }

  if (!res.ok) {
    console.error(`[freelancer] API error ${res.status}: ${await res.text()}`);
    return [];
  }

  const data = await res.json();
  const projects = data?.result?.projects ?? [];

  return projects.map((p) => ({
    source: "freelancer.com",
    title: p.title,
    description: p.preview_description || p.description || "",
    sourceUrl: `https://www.freelancer.com/projects/${p.seo_url || p.id}`,
    budget: p.budget
      ? `${p.budget.minimum ?? "?"}-${p.budget.maximum ?? "?"} ${p.currency?.code ?? ""}`
      : "not specified",
    postedAt: p.submitdate
      ? new Date(p.submitdate * 1000).toISOString()
      : new Date().toISOString()
  }));
}

// Freelancer.com API docs: https://developers.freelancer.com/docs
// Requires an OAuth access token (FREELANCER_OAUTH_TOKEN). Register an app
// and generate a token for your own account at https://developers.freelancer.com.

const API_BASE = "https://www.freelancer.com/api/projects/0.1/projects/active";

export async function fetchFreelancerLeads(query) {
  const token = process.env.FREELANCER_OAUTH_TOKEN;
  if (!token) {
    console.warn("[freelancer] FREELANCER_OAUTH_TOKEN not set — skipping this source.");
    return [];
  }

  const params = new URLSearchParams({
    query,
    limit: "20",
    full_description: "true",
    job_details: "true"
  });

  const res = await fetch(`${API_BASE}?${params.toString()}`, {
    headers: { "Freelancer-OAuth-V1": token }
  });

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

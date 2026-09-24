// Google Programmable Search / Custom Search JSON API docs:
// https://developers.google.com/custom-search/v1/overview
// Requires GOOGLE_API_KEY and GOOGLE_CSE_ID (a search engine configured to
// search the whole web, not just specific sites).

const API_BASE = "https://www.googleapis.com/customsearch/v1";

export async function fetchGoogleLeads(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    console.warn("[google] GOOGLE_API_KEY/GOOGLE_CSE_ID not set — skipping this source.");
    return [];
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: "10"
  });

  const res = await fetch(`${API_BASE}?${params.toString()}`);
  if (!res.ok) {
    console.error(`[google] API error ${res.status}: ${await res.text()}`);
    return [];
  }

  const data = await res.json();
  const items = data?.items ?? [];

  return items.map((item) => ({
    source: "google-search",
    title: item.title,
    description: item.snippet || "",
    sourceUrl: item.link,
    budget: "not specified",
    postedAt: new Date().toISOString()
  }));
}

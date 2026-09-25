// Google's free-tier alternative to the Claude scoring/drafting step. Same
// two exported functions, same call signatures — lib/pipeline.js doesn't
// need to know or care which provider is behind them.
//
// Get a key with no card required at https://aistudio.google.com
// ("Get API key" → "Create API key"). Free tier has a daily request cap —
// if you hit GEMINI_MODEL 404s or rate limits, check
// https://ai.google.dev/gemini-api/docs/models for current model names and
// override via the GEMINI_MODEL env var.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

async function callGemini({ system, prompt, maxTokens = 1024 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env");

  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

// Returns { score: 0-100, reason: string, reject: boolean }
export async function scoreLead(lead, profile) {
  const system = `You score freelance gig leads for fit against a freelancer's profile.
Respond ONLY with valid JSON, no preamble, no markdown fences, in this exact shape:
{"score": <integer 0-100>, "reason": "<one sentence>", "reject": <true|false>}
Set "reject" to true if the lead matches any dealbreaker or is clearly not a real
paid gig (e.g. spam, unrelated content, no budget signal at all when one is expected).`;

  const prompt = `Freelancer profile:
- Bio: ${profile.bio}
- Skills: ${profile.skills.join(", ")}
- Minimum acceptable rate/budget: $${profile.minRateUSD}
- Dealbreakers: ${profile.dealbreakers.join(", ")}

Lead:
- Title: ${lead.title}
- Description: ${lead.description}
- Budget: ${lead.budget}
- Source: ${lead.source}`;

  const raw = await callGemini({ system, prompt, maxTokens: 300 });
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { score: 0, reason: "Could not parse scoring response.", reject: true };
  }
}

// Returns a drafted proposal string, grounded in the freelancer's own portfolio snippets.
export async function draftProposal(lead, profile) {
  const system = `You draft short, specific freelance proposals. Reference concrete
details from the lead's brief. Never use generic filler like "I am the perfect fit"
or "I have read your job posting carefully". Keep it under 150 words. Plain text only,
no markdown.`;

  const prompt = `Freelancer bio: ${profile.bio}
Relevant past work:
${profile.portfolioSnippets.map((s) => `- ${s}`).join("\n")}

Gig brief:
Title: ${lead.title}
Description: ${lead.description}
Budget: ${lead.budget}

Draft a proposal for this specific gig.`;

  return await callGemini({ system, prompt, maxTokens: 400 });
}

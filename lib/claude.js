const API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude({ model, system, prompt, maxTokens = 1024 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in .env");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((c) => c.type === "text");
  return textBlock?.text ?? "";
}

// Returns { score: 0-100, reason: string, reject: boolean }
export async function scoreLead(lead, profile) {
  const model = process.env.CLAUDE_SCORE_MODEL || "claude-haiku-4-5-20251001";

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

  const raw = await callClaude({ model, system, prompt, maxTokens: 300 });
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { score: 0, reason: "Could not parse scoring response.", reject: true };
  }
}

// Returns a drafted proposal string, grounded in the freelancer's own portfolio snippets.
export async function draftProposal(lead, profile) {
  const model = process.env.CLAUDE_DRAFT_MODEL || "claude-sonnet-5";

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

  return await callClaude({ model, system, prompt, maxTokens: 400 });
}

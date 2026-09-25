const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

async function callGemini({ model, system, prompt, maxTokens = 1024, jsonOutput = false }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env");

  const res = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: system }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(jsonOutput ? { responseMimeType: "application/json" } : {})
        }
      })
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim() ?? "";
}

// Returns { score: 0-100, reason: string, reject: boolean }
export async function scoreLead(lead, profile) {
  const model = process.env.GEMINI_SCORE_MODEL || "gemini-3.5-flash-lite";

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

  const raw = await callGemini({
    model,
    system,
    prompt,
    maxTokens: 300,
    jsonOutput: true
  });

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { score: 0, reason: "Could not parse scoring response.", reject: true };
  }
}

// Returns a drafted proposal string, grounded in the freelancer's own portfolio snippets.
export async function draftProposal(lead, profile) {
  const model = process.env.GEMINI_DRAFT_MODEL || "gemini-3.5-flash-lite";

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

  return await callGemini({ model, system, prompt, maxTokens: 400 });
}

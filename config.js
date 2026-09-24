// Edit this file with your own details. Nothing here is sent anywhere except
// to the Claude API (for scoring/drafting) and to your own search queries.

export const profile = {
  // Short summary of who you are and what you do — used in every draft proposal.
  bio: "Freelancer offering [your service, e.g. 'full-stack JavaScript development and API integrations'] with [X years] of experience.",

  // Skills/keywords to search for and match against.
  skills: ["JavaScript", "Node.js", "React", "API integration"],

  // Minimum acceptable rate/budget. Used by the scorer to down-rank underpaid gigs.
  minRateUSD: 25, // per hour, or treat as a minimum fixed-price budget — your call

  // Hard dealbreakers — the scorer will reject any lead matching these.
  dealbreakers: [
    "unpaid",
    "equity only",
    "no budget mentioned"
  ],

  // A few real snippets of past work, used to make drafted proposals specific
  // rather than generic. Replace with your own.
  portfolioSnippets: [
    "Built a real-time inventory dashboard for a 20-person e-commerce team, cutting stock-out incidents by 30%.",
    "Integrated Stripe and QuickBooks for a subscription SaaS, automating monthly reconciliation."
  ]
};

export const searchConfig = {
  // Freelancer.com: search query terms (comma-separated OR'd on their side per call)
  freelancerQuery: "javascript node react api",

  // Google Custom Search: run one query per string here. Use site: filters to
  // target forums/boards/blogs that post gigs but have no API of their own.
  // Twitter/X and Facebook/Threads are NOT included here — see README for why.
  googleQueries: [
    "javascript freelance gig \"hiring\" -job -jobs site:reddit.com",
    "\"looking for a developer\" javascript react freelance",
    "node.js contract project \"budget\" site:weworkremotely.com"
  ]
};

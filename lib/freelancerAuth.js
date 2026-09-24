import { getFreelancerTokens, saveFreelancerTokens } from "./store.js";

const TOKEN_URL = "https://accounts.freelancer.com/oauth/token";
// Refresh a bit before actual expiry so a slow request never gets caught
// using a token that expires mid-flight.
const EXPIRY_BUFFER_SECONDS = 60;

async function refreshTokens(refreshToken) {
  const clientId = process.env.FREELANCER_CLIENT_ID;
  const clientSecret = process.env.FREELANCER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "FREELANCER_CLIENT_ID / FREELANCER_CLIENT_SECRET are not set — required to refresh the Freelancer token."
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!res.ok) {
    throw new Error(`Freelancer token refresh failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  // Freelancer may or may not rotate the refresh token on each use — keep
  // the old one if a new one isn't returned.
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    // expires_in is in seconds; store an absolute timestamp instead so we
    // don't need to remember when it was fetched.
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000
  };
}

// Returns a currently-valid access token, refreshing and persisting a new
// one first if the stored one is missing or expired. This is what makes the
// token durable across Vercel's stateless serverless invocations — the new
// token is saved to the same store leads use (Redis in production, a local
// file for local dev), not just kept in memory.
export async function getValidFreelancerAccessToken() {
  let tokens = await getFreelancerTokens();

  // First run: seed from .env if nothing has been stored yet.
  if (!tokens) {
    const seedRefreshToken = process.env.FREELANCER_REFRESH_TOKEN;
    if (!seedRefreshToken) {
      throw new Error(
        "No Freelancer tokens found and FREELANCER_REFRESH_TOKEN is not set in .env — see README for how to get one."
      );
    }
    tokens = { access_token: null, refresh_token: seedRefreshToken, expires_at: 0 };
  }

  const isExpired = !tokens.access_token || Date.now() > tokens.expires_at - EXPIRY_BUFFER_SECONDS * 1000;
  if (!isExpired) return tokens.access_token;

  const refreshed = await refreshTokens(tokens.refresh_token);
  await saveFreelancerTokens(refreshed);
  return refreshed.access_token;
}

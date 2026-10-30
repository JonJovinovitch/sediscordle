// Logging in (through Discord, or the test login) and talking to the server.
import { DiscordSDK } from "@discord/embedded-app-sdk";

let session = null;

export const insideDiscord = () => new URLSearchParams(window.location.search).has("frame_id");

async function call(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
      ...(options.headers || {}),
    },
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.error;
    throw err;
  }
  return data;
}

export const getConfig = () => call("/api/config");

export async function loginWithDiscord(clientId) {
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });
  const data = await call("/api/token", {
    method: "POST",
    body: JSON.stringify({ code, guildId: sdk.guildId }),
  });
  await sdk.commands.authenticate({ access_token: data.access_token });
  session = data.session;
  return data;
}

export async function devLogin(name) {
  const data = await call("/api/dev-login", { method: "POST", body: JSON.stringify({ name }) });
  session = data.session;
  return data;
}

export const loadGame = () => call("/api/game");
export const sendGuess = (word, day) =>
  call("/api/guess", { method: "POST", body: JSON.stringify({ word, day }) });
export const loadLeaderboard = () => call("/api/leaderboard");
export const startHard = () => call("/api/start-hard", { method: "POST", body: "{}" });

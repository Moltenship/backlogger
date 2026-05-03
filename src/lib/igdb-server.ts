import { createServerFn } from "@tanstack/react-start";

import { mapIgdbGame, type IgdbGamePage, type IgdbGameResponse } from "@/lib/igdb";

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API_URL = "https://api.igdb.com/v4";
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

let cachedToken: CachedToken | null = null;

function getIgdbCredentials() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET.");
  }

  return { clientId, clientSecret };
}

async function getTwitchAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getIgdbCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(`${TWITCH_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Twitch token: ${response.status} ${response.statusText}`);
  }

  const token = (await response.json()) as TwitchTokenResponse;
  cachedToken = {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MS,
  };

  return cachedToken.accessToken;
}

async function igdbRequest<T>(endpoint: string, query: string) {
  const { clientId } = getIgdbCredentials();
  const accessToken = await getTwitchAccessToken();
  const response = await fetch(`${IGDB_API_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Client-ID": clientId,
      "Content-Type": "text/plain",
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(`IGDB ${endpoint} request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchGameById(gameId: number): Promise<IgdbGamePage | null> {
  const games = await igdbRequest<IgdbGameResponse[]>(
    "games",
    [
      "fields name,summary,first_release_date,rating,aggregated_rating,",
      "cover.image_id,screenshots.image_id,genres.name,platforms.name,platforms.abbreviation,",
      "involved_companies.developer,involved_companies.publisher,involved_companies.company.name,",
      "similar_games.name,similar_games.rating,similar_games.cover.image_id;",
      `where id = ${gameId};`,
      "limit 1;",
    ].join(" "),
  );

  return games[0] ? mapIgdbGame(games[0]) : null;
}

export const getIgdbGame = createServerFn({ method: "GET" })
  .inputValidator((data: { gameId: string }) => data)
  .handler(async ({ data }) => {
    const gameId = Number.parseInt(data.gameId, 10);

    if (!Number.isFinite(gameId) || gameId <= 0) {
      return {
        game: null,
        error: "Invalid IGDB game id.",
      };
    }

    try {
      return {
        game: await fetchGameById(gameId),
        error: null,
      };
    } catch (error) {
      return {
        game: null,
        error: error instanceof Error ? error.message : "Failed to load IGDB game.",
      };
    }
  });

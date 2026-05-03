import { createServerFn } from "@tanstack/react-start";

import {
  mapIgdbGame,
  mapIgdbRelatedGame,
  type IgdbGamePage,
  type IgdbGameResponse,
  type IgdbRelatedGame,
  type IgdbRelatedGameGroup,
  type IgdbRelatedGameResponse,
} from "@/lib/igdb";

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
const RELATED_GAMES_PAGE_SIZE = 12;

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

function escapeApicalypseString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function franchiseIds(game: IgdbGameResponse) {
  const ids = [
    game.franchise?.id,
    ...(game.franchises ?? []).map((franchise) => franchise.id),
  ].filter((id): id is number => typeof id === "number");

  return [...new Set(ids)];
}

function franchiseName(game: IgdbGameResponse) {
  const franchise = game.franchise ?? game.franchises?.[0];

  return franchise?.name ?? null;
}

function mapRelatedGroup({
  games,
  key,
  title,
}: {
  games: IgdbRelatedGameResponse[] | undefined;
  key: string;
  title: string;
}): IgdbRelatedGameGroup | null {
  const mappedGames = (games ?? []).map(mapIgdbRelatedGame);

  if (mappedGames.length === 0) {
    return null;
  }

  return {
    key,
    title,
    games: mappedGames,
  };
}

function directRelationshipGroups(game: IgdbGameResponse) {
  return [
    mapRelatedGroup({
      key: "parent-game",
      title: "Parent Game",
      games: game.parent_game ? [game.parent_game] : undefined,
    }),
    mapRelatedGroup({
      key: "version-parent",
      title: "Version Parent",
      games: game.version_parent ? [game.version_parent] : undefined,
    }),
    mapRelatedGroup({ key: "dlcs", title: "DLCs", games: game.dlcs }),
    mapRelatedGroup({ key: "expansions", title: "Expansions", games: game.expansions }),
    mapRelatedGroup({
      key: "standalone-expansions",
      title: "Standalone Expansions",
      games: game.standalone_expansions,
    }),
    mapRelatedGroup({
      key: "expanded-games",
      title: "Expanded Games",
      games: game.expanded_games,
    }),
    mapRelatedGroup({ key: "remakes", title: "Remakes", games: game.remakes }),
    mapRelatedGroup({ key: "remasters", title: "Remasters", games: game.remasters }),
    mapRelatedGroup({ key: "ports", title: "Ports", games: game.ports }),
    mapRelatedGroup({ key: "forks", title: "Forks", games: game.forks }),
  ].filter((group): group is IgdbRelatedGameGroup => Boolean(group));
}

async function fetchGameBySlug(slug: string): Promise<IgdbGamePage | null> {
  const games = await igdbRequest<IgdbGameResponse[]>(
    "games",
    [
      "fields name,slug,summary,first_release_date,rating,aggregated_rating,",
      "rating_count,aggregated_rating_count,cover.image_id,screenshots.image_id,",
      "genres.name,game_engines.name,game_modes.name,platforms.name,platforms.abbreviation,",
      "player_perspectives.name,themes.name,",
      "involved_companies.developer,involved_companies.publisher,involved_companies.company.name,",
      "similar_games.name,similar_games.slug,similar_games.rating,similar_games.cover.image_id;",
      `where slug = "${escapeApicalypseString(slug)}";`,
      "limit 1;",
    ].join(" "),
  );

  return games[0] ? mapIgdbGame(games[0]) : null;
}

async function fetchGameFranchises(slug: string) {
  const games = await igdbRequest<IgdbGameResponse[]>(
    "games",
    [
      "fields id,franchise.id,franchise.name,franchises.id,franchises.name,",
      "dlcs.name,dlcs.slug,dlcs.first_release_date,dlcs.rating,dlcs.cover.image_id,",
      "expanded_games.name,expanded_games.slug,expanded_games.first_release_date,expanded_games.rating,expanded_games.cover.image_id,",
      "expansions.name,expansions.slug,expansions.first_release_date,expansions.rating,expansions.cover.image_id,",
      "forks.name,forks.slug,forks.first_release_date,forks.rating,forks.cover.image_id,",
      "parent_game.name,parent_game.slug,parent_game.first_release_date,parent_game.rating,parent_game.cover.image_id,",
      "ports.name,ports.slug,ports.first_release_date,ports.rating,ports.cover.image_id,",
      "remakes.name,remakes.slug,remakes.first_release_date,remakes.rating,remakes.cover.image_id,",
      "remasters.name,remasters.slug,remasters.first_release_date,remasters.rating,remasters.cover.image_id,",
      "standalone_expansions.name,standalone_expansions.slug,standalone_expansions.first_release_date,standalone_expansions.rating,standalone_expansions.cover.image_id,",
      "version_parent.name,version_parent.slug,version_parent.first_release_date,version_parent.rating,version_parent.cover.image_id;",
      `where slug = "${escapeApicalypseString(slug)}";`,
      "limit 1;",
    ].join(" "),
  );

  return games[0] ?? null;
}

async function fetchRelatedFranchiseGames({ page, slug }: { page: number; slug: string }): Promise<{
  franchiseName: string | null;
  games: IgdbRelatedGame[];
  groups: IgdbRelatedGameGroup[];
  hasNextPage: boolean;
  page: number;
}> {
  const game = await fetchGameFranchises(slug);

  if (!game?.id) {
    return {
      franchiseName: null,
      games: [],
      groups: [],
      hasNextPage: false,
      page,
    };
  }

  const ids = franchiseIds(game);
  const groups = directRelationshipGroups(game);

  if (ids.length === 0) {
    return {
      franchiseName: null,
      games: [],
      groups,
      hasNextPage: false,
      page,
    };
  }

  const offset = (page - 1) * RELATED_GAMES_PAGE_SIZE;
  const idsFilter = ids.join(",");
  const relatedGames = await igdbRequest<IgdbRelatedGameResponse[]>(
    "games",
    [
      "fields name,slug,first_release_date,rating,cover.image_id;",
      `where (franchises = (${idsFilter}) | franchise = (${idsFilter})) & id != ${game.id};`,
      "sort first_release_date desc;",
      `limit ${RELATED_GAMES_PAGE_SIZE + 1};`,
      `offset ${offset};`,
    ].join(" "),
  );

  return {
    franchiseName: franchiseName(game),
    games: relatedGames.slice(0, RELATED_GAMES_PAGE_SIZE).map(mapIgdbRelatedGame),
    groups,
    hasNextPage: relatedGames.length > RELATED_GAMES_PAGE_SIZE,
    page,
  };
}

export const getIgdbGame = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const slug = data.slug.trim();

    if (!slug) {
      return {
        game: null,
        error: "Invalid IGDB game slug.",
      };
    }

    try {
      return {
        game: await fetchGameBySlug(slug),
        error: null,
      };
    } catch (error) {
      return {
        game: null,
        error: error instanceof Error ? error.message : "Failed to load IGDB game.",
      };
    }
  });

export const getIgdbRelatedFranchiseGames = createServerFn({ method: "GET" })
  .inputValidator((data: { page: number; slug: string }) => data)
  .handler(async ({ data }) => {
    const slug = data.slug.trim();
    const page = Math.max(1, Math.floor(data.page));

    if (!slug) {
      return {
        related: null,
        error: "Invalid IGDB game slug.",
      };
    }

    try {
      return {
        related: await fetchRelatedFranchiseGames({ page, slug }),
        error: null,
      };
    } catch (error) {
      return {
        related: null,
        error: error instanceof Error ? error.message : "Failed to load IGDB franchise games.",
      };
    }
  });

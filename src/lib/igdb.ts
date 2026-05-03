export interface IgdbImage {
  image_id?: string;
}

export interface IgdbNamedEntity {
  name?: string;
  abbreviation?: string;
}

export interface IgdbCompanyCredit {
  developer?: boolean;
  publisher?: boolean;
  company?: IgdbNamedEntity;
}

export interface IgdbSimilarGame {
  id?: number;
  name?: string;
  slug?: string;
  rating?: number;
  cover?: IgdbImage;
}

export interface IgdbFranchiseReference {
  id?: number;
  name?: string;
}

export interface IgdbGameResponse {
  id?: number;
  name?: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  cover?: IgdbImage;
  screenshots?: IgdbImage[];
  genres?: IgdbNamedEntity[];
  game_engines?: IgdbNamedEntity[];
  game_modes?: IgdbNamedEntity[];
  platforms?: IgdbNamedEntity[];
  player_perspectives?: IgdbNamedEntity[];
  themes?: IgdbNamedEntity[];
  franchise?: IgdbFranchiseReference;
  franchises?: IgdbFranchiseReference[];
  dlcs?: IgdbRelatedGameResponse[];
  expanded_games?: IgdbRelatedGameResponse[];
  expansions?: IgdbRelatedGameResponse[];
  forks?: IgdbRelatedGameResponse[];
  parent_game?: IgdbRelatedGameResponse;
  ports?: IgdbRelatedGameResponse[];
  remakes?: IgdbRelatedGameResponse[];
  remasters?: IgdbRelatedGameResponse[];
  standalone_expansions?: IgdbRelatedGameResponse[];
  version_parent?: IgdbRelatedGameResponse;
  involved_companies?: IgdbCompanyCredit[];
  similar_games?: IgdbSimilarGame[];
}

export interface IgdbRelatedGameResponse {
  id?: number;
  name?: string;
  slug?: string;
  first_release_date?: number;
  rating?: number;
  cover?: IgdbImage;
}

export interface IgdbGamePage {
  id: number;
  slug: string;
  name: string;
  summary: string;
  releaseDate: string;
  releaseYear: string;
  rating: number | null;
  ratingCount: number | null;
  aggregatedRating: number | null;
  aggregatedRatingCount: number | null;
  coverUrl: string | null;
  heroUrl: string | null;
  screenshots: string[];
  genres: string[];
  gameEngines: string[];
  gameModes: string[];
  platforms: string[];
  playerPerspectives: string[];
  themes: string[];
  developers: string[];
  publishers: string[];
  similarGames: {
    id: number;
    slug: string;
    name: string;
    rating: number | null;
    coverUrl: string | null;
  }[];
}

export interface IgdbRelatedGame {
  id: number;
  slug: string;
  name: string;
  releaseYear: string;
  rating: number | null;
  coverUrl: string | null;
}

export interface IgdbRelatedGameGroup {
  key: string;
  title: string;
  games: IgdbRelatedGame[];
}

function compactNames(items: IgdbNamedEntity[] | undefined, preferAbbreviation = false) {
  return (items ?? [])
    .map((item) => (preferAbbreviation ? item.abbreviation || item.name : item.name))
    .filter((item): item is string => Boolean(item));
}

function imageUrl(imageId: string | undefined, size: "cover_big_2x" | "screenshot_big_2x") {
  if (!imageId) {
    return null;
  }

  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

function dateFromUnixSeconds(value: number | undefined) {
  if (!value) {
    return {
      releaseDate: "Unknown",
      releaseYear: "TBA",
    };
  }

  const isoDate = new Date(value * 1000).toISOString().slice(0, 10);

  return {
    releaseDate: isoDate,
    releaseYear: isoDate.slice(0, 4),
  };
}

function roundedRating(value: number | undefined) {
  return typeof value === "number" ? Math.round(value) : null;
}

function normalizedCount(value: number | undefined) {
  return typeof value === "number" ? value : null;
}

function companyNames(
  credits: IgdbCompanyCredit[] | undefined,
  predicate: (credit: IgdbCompanyCredit) => boolean,
) {
  return (credits ?? [])
    .filter(predicate)
    .map((credit) => credit.company?.name)
    .filter((item): item is string => Boolean(item));
}

export function mapIgdbGame(game: IgdbGameResponse): IgdbGamePage {
  const { releaseDate, releaseYear } = dateFromUnixSeconds(game.first_release_date);
  const screenshots = (game.screenshots ?? [])
    .map((screenshot) => imageUrl(screenshot.image_id, "screenshot_big_2x"))
    .filter((item): item is string => Boolean(item));

  return {
    id: game.id ?? 0,
    slug: game.slug ?? String(game.id ?? ""),
    name: game.name ?? "Untitled Game",
    summary: game.summary ?? "No summary is available for this game yet.",
    releaseDate,
    releaseYear,
    rating: roundedRating(game.rating),
    ratingCount: normalizedCount(game.rating_count),
    aggregatedRating: roundedRating(game.aggregated_rating),
    aggregatedRatingCount: normalizedCount(game.aggregated_rating_count),
    coverUrl: imageUrl(game.cover?.image_id, "cover_big_2x"),
    heroUrl: screenshots[0] ?? null,
    screenshots,
    genres: compactNames(game.genres),
    gameEngines: compactNames(game.game_engines),
    gameModes: compactNames(game.game_modes),
    platforms: compactNames(game.platforms, true),
    playerPerspectives: compactNames(game.player_perspectives),
    themes: compactNames(game.themes),
    developers: companyNames(game.involved_companies, (credit) => credit.developer === true),
    publishers: companyNames(game.involved_companies, (credit) => credit.publisher === true),
    similarGames: (game.similar_games ?? []).map((similarGame) => ({
      id: similarGame.id ?? 0,
      slug: similarGame.slug ?? String(similarGame.id ?? ""),
      name: similarGame.name ?? "Untitled Game",
      rating: roundedRating(similarGame.rating),
      coverUrl: imageUrl(similarGame.cover?.image_id, "cover_big_2x"),
    })),
  };
}

export function mapIgdbRelatedGame(game: IgdbRelatedGameResponse): IgdbRelatedGame {
  const { releaseYear } = dateFromUnixSeconds(game.first_release_date);

  return {
    id: game.id ?? 0,
    slug: game.slug ?? String(game.id ?? ""),
    name: game.name ?? "Untitled Game",
    releaseYear,
    rating: roundedRating(game.rating),
    coverUrl: imageUrl(game.cover?.image_id, "cover_big_2x"),
  };
}

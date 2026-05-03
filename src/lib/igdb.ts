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

export interface IgdbGameResponse {
  id?: number;
  name?: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  rating?: number;
  aggregated_rating?: number;
  cover?: IgdbImage;
  screenshots?: IgdbImage[];
  genres?: IgdbNamedEntity[];
  platforms?: IgdbNamedEntity[];
  involved_companies?: IgdbCompanyCredit[];
  similar_games?: IgdbSimilarGame[];
}

export interface IgdbGamePage {
  id: number;
  slug: string;
  name: string;
  summary: string;
  releaseDate: string;
  releaseYear: string;
  rating: number | null;
  aggregatedRating: number | null;
  coverUrl: string | null;
  heroUrl: string | null;
  screenshots: string[];
  genres: string[];
  platforms: string[];
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
    aggregatedRating: roundedRating(game.aggregated_rating),
    coverUrl: imageUrl(game.cover?.image_id, "cover_big_2x"),
    heroUrl: screenshots[0] ?? null,
    screenshots,
    genres: compactNames(game.genres),
    platforms: compactNames(game.platforms, true),
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

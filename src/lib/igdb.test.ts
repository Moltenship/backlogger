import { describe, expect, it } from "vitest";

import { mapIgdbGame } from "@/lib/igdb";

describe("igdb game mapping", () => {
  it("normalizes a rich IGDB game response for the game page", () => {
    expect.assertions(1);

    const game = mapIgdbGame({
      id: 1942,
      name: "Hollow Knight",
      summary: "Descend into Hallownest.",
      first_release_date: 1501545600,
      rating: 91.2,
      aggregated_rating: 87.8,
      cover: {
        image_id: "co1rgi",
      },
      screenshots: [{ image_id: "sc1" }, { image_id: "sc2" }],
      genres: [{ name: "Platform" }, { name: "Adventure" }],
      platforms: [{ abbreviation: "PC" }, { name: "Nintendo Switch" }],
      involved_companies: [
        {
          developer: true,
          company: { name: "Team Cherry" },
        },
        {
          publisher: true,
          company: { name: "Team Cherry" },
        },
      ],
      similar_games: [
        {
          id: 2,
          name: "Celeste",
          rating: 88,
          cover: { image_id: "co2" },
        },
      ],
    });

    expect(game).toStrictEqual({
      id: 1942,
      name: "Hollow Knight",
      summary: "Descend into Hallownest.",
      releaseDate: "2017-08-01",
      releaseYear: "2017",
      rating: 91,
      aggregatedRating: 88,
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1rgi.jpg",
      heroUrl: "https://images.igdb.com/igdb/image/upload/t_screenshot_big_2x/sc1.jpg",
      screenshots: [
        "https://images.igdb.com/igdb/image/upload/t_screenshot_big_2x/sc1.jpg",
        "https://images.igdb.com/igdb/image/upload/t_screenshot_big_2x/sc2.jpg",
      ],
      genres: ["Platform", "Adventure"],
      platforms: ["PC", "Nintendo Switch"],
      developers: ["Team Cherry"],
      publishers: ["Team Cherry"],
      similarGames: [
        {
          id: 2,
          name: "Celeste",
          rating: 88,
          coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2.jpg",
        },
      ],
    });
  });

  it("uses stable fallbacks for sparse IGDB responses", () => {
    expect.assertions(1);

    const game = mapIgdbGame({
      id: 3,
      name: "Untitled Game",
    });

    expect(game).toStrictEqual({
      id: 3,
      name: "Untitled Game",
      summary: "No summary is available for this game yet.",
      releaseDate: "Unknown",
      releaseYear: "TBA",
      rating: null,
      aggregatedRating: null,
      coverUrl: null,
      heroUrl: null,
      screenshots: [],
      genres: [],
      platforms: [],
      developers: [],
      publishers: [],
      similarGames: [],
    });
  });
});

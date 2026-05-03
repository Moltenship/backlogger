/* eslint-disable jest/max-expects, vitest/max-expects, vitest/prefer-to-be-falsy, vitest/prefer-to-be-truthy */
import { describe, expect, it } from "vitest";

import {
  GAME_ENTRY_STATUSES,
  isGameEntryStatus,
  isValidStarRating,
  normalizeReview,
} from "@/lib/game-entry";

describe("game entry helpers", () => {
  it("recognizes the supported primary statuses", () => {
    expect.assertions(6);

    expect(GAME_ENTRY_STATUSES).toStrictEqual(["backlog", "playing", "completed", "dropped"]);
    expect(isGameEntryStatus("backlog")).toBe(true);
    expect(isGameEntryStatus("playing")).toBe(true);
    expect(isGameEntryStatus("completed")).toBe(true);
    expect(isGameEntryStatus("dropped")).toBe(true);
    expect(isGameEntryStatus("wishlist")).toBe(false);
  });

  it("accepts only half-star ratings from 0.5 to 5", () => {
    expect.assertions(8);

    expect(isValidStarRating(null)).toBe(true);
    expect(isValidStarRating(0.5)).toBe(true);
    expect(isValidStarRating(3)).toBe(true);
    expect(isValidStarRating(4.5)).toBe(true);
    expect(isValidStarRating(5)).toBe(true);
    expect(isValidStarRating(0)).toBe(false);
    expect(isValidStarRating(5.5)).toBe(false);
    expect(isValidStarRating(4.25)).toBe(false);
  });

  it("normalizes optional reviews", () => {
    expect.assertions(3);

    expect(normalizeReview(null)).toBeNull();
    expect(normalizeReview("   ")).toBeNull();
    expect(normalizeReview("  Great pacing.  ")).toBe("Great pacing.");
  });
});

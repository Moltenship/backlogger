/* eslint-disable jest/max-expects, vitest/max-expects, vitest/prefer-to-be-falsy, vitest/prefer-to-be-truthy */
import { describe, expect, it } from "vitest";

import {
  formatActivityMessage,
  formatDayKey,
  GAME_ENTRY_STATUSES,
  getPlaythroughLabel,
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

  it("formats UTC day keys for activity buckets", () => {
    expect.assertions(2);

    expect(formatDayKey(Date.UTC(2026, 0, 2, 23, 59))).toBe("2026-01-02");
    expect(formatDayKey(Date.UTC(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });

  it("formats playthrough count labels", () => {
    expect.assertions(3);

    expect(getPlaythroughLabel(0)).toBeNull();
    expect(getPlaythroughLabel(1)).toBeNull();
    expect(getPlaythroughLabel(2)).toBe("2 playthroughs");
  });

  it("formats profile status activity messages", () => {
    expect.assertions(5);

    expect(formatActivityMessage({ name: "Hades", toStatus: "playing", playthroughIndex: 1 })).toBe(
      "Started playing Hades",
    );
    expect(formatActivityMessage({ name: "Hades", toStatus: "playing", playthroughIndex: 2 })).toBe(
      "Started replaying Hades",
    );
    expect(
      formatActivityMessage({ name: "Hades", toStatus: "completed", playthroughIndex: 2 }),
    ).toBe("Completed a replay of Hades");
    expect(formatActivityMessage({ name: "Hades", toStatus: "backlog", playthroughIndex: 1 })).toBe(
      "Backlogged Hades",
    );
    expect(formatActivityMessage({ name: "Hades", toStatus: "dropped", playthroughIndex: 1 })).toBe(
      "Dropped Hades",
    );
  });
});

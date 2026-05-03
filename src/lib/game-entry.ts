export const GAME_ENTRY_STATUSES = ["backlog", "playing", "completed", "dropped"] as const;

export type GameEntryStatus = (typeof GAME_ENTRY_STATUSES)[number];

export const GAME_ENTRY_STATUS_LABELS: Record<GameEntryStatus, string> = {
  backlog: "Backlog",
  playing: "Playing",
  completed: "Completed",
  dropped: "Dropped",
};

export interface GameEntrySnapshot {
  igdbId: number;
  slug: string;
  name: string;
  coverUrl: string | null;
  releaseYear: string;
}

export interface GameEntryCard extends GameEntrySnapshot {
  status: GameEntryStatus;
  rating: number | null;
  review: string | null;
  updatedAt: number;
}

export interface GameEntryProfile {
  counts: Record<GameEntryStatus | "total", number>;
  shelves: Record<GameEntryStatus, GameEntryCard[]>;
}

export function isGameEntryStatus(value: string): value is GameEntryStatus {
  return GAME_ENTRY_STATUSES.includes(value as GameEntryStatus);
}

export function isValidStarRating(value: number | null): boolean {
  if (value === null) {
    return true;
  }

  return value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

export function normalizeReview(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

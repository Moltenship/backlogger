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
  playthroughCount: number;
  playthroughIndex: number;
  updatedAt: number;
}

export interface GameEntryProfile {
  counts: Record<GameEntryStatus | "total", number>;
  shelves: Record<GameEntryStatus, GameEntryCard[]>;
  activity: GameEntryProfileActivity;
}

export interface GameEntryActivityBucket {
  dayKey: string;
  count: number;
}

export interface GameEntryActivityItem {
  id: string;
  dayKey: string;
  createdAt: number;
  igdbId: number;
  slug: string;
  name: string;
  coverUrl: string | null;
  review: string | null;
  fromStatus: GameEntryStatus | null;
  toStatus: GameEntryStatus;
  playthroughIndex: number;
}

export interface GameEntryActivitySummary {
  recentActiveDays: number;
  recentStatusUpdates: number;
  recentActivityLimit: number;
}

export interface GameEntryProfileActivity {
  summary: GameEntryActivitySummary;
  heatmap: GameEntryActivityBucket[];
  recent: GameEntryActivityItem[];
}

export interface GameEntryActivityMessageInput {
  name: string;
  toStatus: GameEntryStatus;
  playthroughIndex: number;
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

export function formatDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function getPlaythroughLabel(playthroughCount: number): string | null {
  return playthroughCount > 1 ? `${playthroughCount} playthroughs` : null;
}

export function formatActivityMessage({
  name,
  playthroughIndex,
  toStatus,
}: GameEntryActivityMessageInput): string {
  const isReplay = playthroughIndex > 1;

  if (toStatus === "playing") {
    return isReplay ? `Started replaying ${name}` : `Started playing ${name}`;
  }

  if (toStatus === "completed") {
    return isReplay ? `Completed a replay of ${name}` : `Completed ${name}`;
  }

  return `Moved ${name} to ${GAME_ENTRY_STATUS_LABELS[toStatus]}`;
}

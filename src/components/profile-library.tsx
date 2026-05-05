import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  GAME_ENTRY_STATUS_LABELS,
  type GameEntryProfile,
  type GameEntryStatus,
} from "@/lib/game-entry";

export const PROFILE_SHELF_STATUSES = ["playing", "backlog", "completed", "dropped"] as const;

export function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border/70 bg-background rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ProfileShelf({
  emptyText,
  games,
  status,
}: {
  emptyText: string;
  games: GameEntryProfile["shelves"][GameEntryStatus];
  status: GameEntryStatus;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {GAME_ENTRY_STATUS_LABELS[status]}
          </h2>
          <p className="text-muted-foreground text-sm">
            {games.length === 0 ? "No games yet." : `${games.length} recent games`}
          </p>
        </div>
        <Badge variant="secondary">{games.length}</Badge>
      </div>

      {games.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {games.map((game) => (
            <ProfileGameCard key={game.igdbId} game={game} />
          ))}
        </div>
      ) : (
        <div className="border-border/70 bg-card text-muted-foreground rounded-lg border p-5 text-sm">
          {emptyText}
        </div>
      )}
    </section>
  );
}

function ProfileGameCard({ game }: { game: GameEntryProfile["shelves"][GameEntryStatus][number] }) {
  return (
    <Link to="/games/$slug/overview" params={{ slug: game.slug }} className="group min-w-0">
      <div className="bg-muted aspect-[3/4] overflow-hidden rounded-md">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt=""
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center">
            <span className="text-muted-foreground text-xs font-medium">{game.name}</span>
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-5 font-medium">{game.name}</p>
      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span>{game.releaseYear}</span>
        <span className="flex items-center gap-1">
          <Star className="size-3 fill-current" />
          {formatRating(game.rating)}
        </span>
      </div>
    </Link>
  );
}

function formatRating(value: number | null) {
  return value === null ? "N/A" : value.toFixed(value % 1 === 0 ? 0 : 1);
}

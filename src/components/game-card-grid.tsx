import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

export interface GameCardItem {
  id: number;
  slug: string;
  name: string;
  coverUrl: string | null;
  rating: number | null;
  releaseYear?: string;
}

export function GameCardGrid({ games }: { games: GameCardItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

function GameCard({ game }: { game: GameCardItem }) {
  return (
    <Link to="/games/$slug/overview" params={{ slug: game.slug }} className="group">
      <div className="bg-muted aspect-[3/4] overflow-hidden rounded">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium">{game.name}</p>
      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem]">
        {game.releaseYear ? <span>{game.releaseYear}</span> : null}
        <span className="flex items-center gap-1">
          <Star className="size-3 fill-current" />
          {formatScore(game.rating)}
        </span>
      </div>
    </Link>
  );
}

function formatScore(score: number | null) {
  return score === null ? "N/A" : String(score);
}

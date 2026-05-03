import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock3,
  Gamepad2,
  Library,
  type LucideIcon,
  MessageSquareText,
  Star,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import type { IgdbGamePage } from "@/lib/igdb";
import { getIgdbGame } from "@/lib/igdb-server";

export const Route = createFileRoute("/games/$gameId")({
  loader: ({ params }) => getIgdbGame({ data: { gameId: params.gameId } }),
  component: GamePage,
});

const friendsActivity = [
  { name: "Lana", action: "rated", value: "4.5", time: "2h ago" },
  { name: "Mako", action: "started playing", value: "Act II", time: "8h ago" },
  { name: "Nia", action: "reviewed", value: "Thoughtful pacing", time: "1d ago" },
  { name: "Rei", action: "added to backlog", value: "Next weekend", time: "2d ago" },
];

function GamePage() {
  const { game, error } = Route.useLoaderData();

  return (
    <AppShell>
      <div className="mx-auto max-w-[100rem] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md">
              B
            </span>
            Backlogger
          </Link>
          <Link
            to="/games/$gameId"
            params={{ gameId: "1942" }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Games
          </Link>
        </div>

        {game ? <GameDetail game={game} /> : <GameError error={error} />}
      </div>
    </AppShell>
  );
}

function GameDetail({ game }: { game: IgdbGamePage }) {
  const heroStyle = game.heroUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgb(0 0 0 / 0.92), rgb(0 0 0 / 0.62), rgb(0 0 0 / 0.88)), url(${game.heroUrl})`,
      }
    : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0 space-y-4">
        <div
          className="border-border/70 bg-card overflow-hidden rounded-lg border bg-cover bg-center shadow-sm"
          style={heroStyle}
        >
          <div className="grid gap-6 p-5 md:grid-cols-[13rem_1fr] md:p-8">
            <Cover game={game} />

            <div className="flex min-w-0 flex-col justify-end py-1">
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span>{game.releaseYear}</span>
                {game.genres.slice(0, 3).map((genre) => (
                  <span key={genre}>• {genre}</span>
                ))}
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                {game.name}
              </h1>

              <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span>Developed by {game.developers[0] ?? "Unknown"}</span>
                <span>Published by {game.publishers[0] ?? "Unknown"}</span>
              </div>

              <p className="text-muted-foreground mt-5 max-w-3xl text-sm leading-6 md:text-base">
                {game.summary}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button>
                  <Gamepad2 className="size-4" />
                  Log Game
                </Button>
                <Button variant="outline">
                  <MessageSquareText className="size-4" />
                  Write Review
                </Button>
                <Button variant="outline">
                  <Library className="size-4" />
                  Add to Backlog
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <Panel title="Screenshots">
              {game.screenshots.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {game.screenshots.slice(0, 6).map((screenshot) => (
                    <img
                      key={screenshot}
                      src={screenshot}
                      alt=""
                      className="aspect-video w-full rounded-md object-cover"
                    />
                  ))}
                </div>
              ) : (
                <EmptyState>No screenshots are available from IGDB yet.</EmptyState>
              )}
            </Panel>

            <Panel title="Community Snapshot">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="IGDB Rating" value={formatScore(game.rating)} />
                <Metric label="Critic Rating" value={formatScore(game.aggregatedRating)} />
                <Metric label="Friends Played" value="12" />
              </div>
            </Panel>
          </div>

          <Panel title="Game Info">
            <InfoRows game={game} />
          </Panel>
        </div>
      </section>

      <aside className="space-y-4">
        <Panel title="Friends Activity" icon={UsersRound}>
          <div className="space-y-4">
            {friendsActivity.map((activity) => (
              <div key={`${activity.name}-${activity.action}`} className="flex gap-3">
                <div className="bg-muted grid size-9 shrink-0 place-items-center rounded-full text-xs font-medium">
                  {activity.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.name}</span>{" "}
                    <span className="text-muted-foreground">{activity.action}</span>
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{activity.value}</p>
                </div>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Similar Games">
          {game.similarGames.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {game.similarGames.slice(0, 4).map((similarGame) => (
                <Link
                  key={similarGame.id}
                  to="/games/$gameId"
                  params={{ gameId: String(similarGame.id) }}
                  className="group"
                >
                  <div className="bg-muted aspect-[3/4] overflow-hidden rounded-md">
                    {similarGame.coverUrl ? (
                      <img
                        src={similarGame.coverUrl}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium">{similarGame.name}</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Star className="size-3 fill-current" />
                    {formatScore(similarGame.rating)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState>No similar games returned yet.</EmptyState>
          )}
        </Panel>
      </aside>
    </div>
  );
}

function Cover({ game }: { game: IgdbGamePage }) {
  return (
    <div className="border-border/70 bg-muted aspect-[3/4] w-full max-w-52 overflow-hidden rounded-lg border shadow-sm">
      {game.coverUrl ? (
        <img src={game.coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="text-muted-foreground grid h-full place-items-center p-6 text-center text-sm">
          No cover
        </div>
      )}
    </div>
  );
}

function Panel({
  children,
  title,
  icon: Icon,
}: {
  children: ReactNode;
  title: string;
  icon?: LucideIcon;
}) {
  return (
    <section className="border-border/70 bg-card rounded-lg border p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {Icon ? <Icon className="size-4" /> : null}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InfoRows({ game }: { game: IgdbGamePage }) {
  const rows = [
    { label: "Release Date", value: game.releaseDate, icon: CalendarDays },
    { label: "Developer", value: game.developers.join(", ") || "Unknown", icon: Gamepad2 },
    { label: "Publisher", value: game.publishers.join(", ") || "Unknown", icon: Library },
    { label: "Platforms", value: game.platforms.join(", ") || "Unknown", icon: Gamepad2 },
    { label: "Est. Progress", value: "Mocked friends activity", icon: Clock3 },
  ];

  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[1rem_7rem_1fr] gap-3 text-sm">
          <row.icon className="text-muted-foreground mt-0.5 size-4" />
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-md p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
      {children}
    </div>
  );
}

function GameError({ error }: { error: string | null }) {
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-2xl items-center">
      <div className="border-border/70 bg-card rounded-lg border p-6 shadow-sm">
        <p className="text-muted-foreground text-sm">IGDB game page</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Game data is not available.</h1>
        <p className="text-muted-foreground mt-3 leading-6">
          {error ??
            "IGDB did not return a game for this id. Check the route id or try another IGDB game."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/games/$gameId"
            params={{ gameId: "1942" }}
            className={buttonVariants({ variant: "default" })}
          >
            Try sample game
          </Link>
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatScore(score: number | null) {
  return score === null ? "N/A" : String(score);
}

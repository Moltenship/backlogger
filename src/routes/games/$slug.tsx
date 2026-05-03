import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouteContext,
  useRouterState,
} from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Gamepad2,
  Gauge,
  Library,
  type LucideIcon,
  MousePointer2,
  Star,
  Tags,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";

import { AppShell } from "@/components/app-shell";
import { GameCardGrid } from "@/components/game-card-grid";
import { GameEntryForm, type GameEntryFormValue } from "@/components/game-entry-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppleDark } from "@/components/ui/svgs/appleDark";
import { EpicgamesIconDark } from "@/components/ui/svgs/epicgamesIconDark";
import { Google } from "@/components/ui/svgs/google";
import { Linux } from "@/components/ui/svgs/linux";
import { Playstation } from "@/components/ui/svgs/playstation";
import { Steam } from "@/components/ui/svgs/steam";
import { Windows } from "@/components/ui/svgs/windows";
import { Xbox } from "@/components/ui/svgs/xbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import {
  GAME_ENTRY_STATUS_LABELS,
  GAME_ENTRY_STATUSES,
  type GameEntryStatus,
  isGameEntryStatus,
} from "@/lib/game-entry";
import type { IgdbGamePage } from "@/lib/igdb";
import { gameQueryOptions } from "@/lib/igdb-query";

import { api } from "../../../convex/_generated/api";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/games/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(gameQueryOptions(params.slug));

    if (data.game) {
      await context.queryClient.ensureQueryData(
        convexQuery(api.gameEntries.viewerEntry, { igdbId: data.game.id }),
      );
    }

    return data;
  },
  component: GamePage,
});

const friendsActivity = [
  { name: "Lana", action: "rated", value: "4.5", time: "2h ago" },
  { name: "Mako", action: "started playing", value: "Act II", time: "8h ago" },
  { name: "Nia", action: "reviewed", value: "Thoughtful pacing", time: "1d ago" },
  { name: "Rei", action: "added to backlog", value: "Next weekend", time: "2d ago" },
];

const statusMenuTriggerButton = (
  <Button aria-label="Choose game status" className="rounded-l-none px-2" size="default" />
);

type PlatformIcon = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
type GameTab = "overview" | "related" | "community";

function GamePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(gameQueryOptions(slug));
  const { isSidebarCollapsed } = useRouteContext({ from: RootRoute.id });

  return (
    <AppShell initialSidebarCollapsed={isSidebarCollapsed}>
      <div className="mx-auto max-w-[100rem] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md">
              B
            </span>
            Backlogger
          </Link>
          <Link
            to="/games/$slug/overview"
            params={{ slug: "the-witcher-3-wild-hunt" }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Games
          </Link>
        </div>

        {data.game ? <GameDetail game={data.game} /> : <GameError error={data.error} />}
      </div>
    </AppShell>
  );
}

function GameDetail({ game }: { game: IgdbGamePage }) {
  const activeTab = useActiveGameTab();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const convexAuth = useConvexAuth();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<GameEntryStatus>("backlog");
  const { data: viewerEntry, isPending: isEntryLoading } = useSuspenseQuery(
    convexQuery(api.gameEntries.viewerEntry, { igdbId: game.id }),
  );
  const upsertGameEntry = useMutation(api.gameEntries.upsert);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const isEntryFormLoading = isEntryLoading;
  const isAuthenticated = Boolean(session?.user) && convexAuth.isAuthenticated;
  const currentStatus = viewerEntry?.status ?? draftStatus;
  const entryDialogValue: GameEntryFormValue = {
    status: draftStatus,
    rating: viewerEntry?.rating ?? null,
    review: viewerEntry?.review ?? null,
  };
  const heroStyle = game.heroUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgb(0 0 0 / 0.92), rgb(0 0 0 / 0.62), rgb(0 0 0 / 0.88)), url(${game.heroUrl})`,
      }
    : undefined;

  useEffect(() => {
    if (viewerEntry) {
      setDraftStatus(viewerEntry.status);
    }
  }, [viewerEntry]);

  function openEntryDialog(status: GameEntryStatus) {
    setSaveError(null);
    setDraftStatus(status);
    setIsEntryDialogOpen(true);
  }

  async function signInWithTwitch() {
    setSaveError(null);

    try {
      await authClient.signIn.social({ provider: "twitch" });
    } catch (error) {
      setSaveError(`Could not start Twitch sign in. ${getErrorMessage(error)}`);
    }
  }

  async function saveEntry(value: GameEntryFormValue) {
    if (!isAuthenticated) {
      setIsEntryDialogOpen(false);
      setSaveError(
        session?.user
          ? "Your login session is active, but the game library is not authenticated yet. Refresh the page or sign in again."
          : "Sign in with Twitch before saving games to your library.",
      );
      return;
    }

    setIsSavingEntry(true);
    setSaveError(null);

    try {
      await upsertGameEntry({
        game: {
          igdbId: game.id,
          slug: game.slug,
          name: game.name,
          coverUrl: game.coverUrl,
          releaseYear: game.releaseYear,
        },
        status: value.status,
        rating: value.rating,
        review: value.review,
      });
      setIsEntryDialogOpen(false);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        setIsEntryDialogOpen(false);
      }

      setSaveError(getSaveErrorMessage(error));
    } finally {
      setIsSavingEntry(false);
    }
  }

  return (
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
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{game.name}</h1>

            <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <span>Developed by {game.developers[0] ?? "Unknown"}</span>
              <span>Published by {game.publishers[0] ?? "Unknown"}</span>
            </div>

            <p className="text-muted-foreground mt-5 max-w-3xl text-sm leading-6 md:text-base">
              {game.summary}
            </p>

            {isEntryFormLoading ? (
              <GameEntryActionLoading />
            ) : (
              <div className="mt-6">
                <GameEntryStatusButton
                  status={currentStatus}
                  onOpen={() => {
                    openEntryDialog(currentStatus);
                  }}
                  onStatusSelect={(status) => {
                    openEntryDialog(status);
                  }}
                />
              </div>
            )}
            {saveError ? (
              <p className="text-destructive mt-2 text-sm" role="alert">
                {saveError}
              </p>
            ) : null}
            <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{GAME_ENTRY_STATUS_LABELS[draftStatus]}</DialogTitle>
                  <DialogDescription>
                    Set your status, optional rating, and optional review for {game.name}.
                  </DialogDescription>
                </DialogHeader>
                <GameEntryForm
                  initialValue={entryDialogValue}
                  isAuthenticated={isAuthenticated}
                  isSaving={isSavingEntry}
                  onSignIn={signInWithTwitch}
                  onSubmit={saveEntry}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          navigate({
            to: getGameTabPath(value),
            params: { slug: game.slug },
          }).catch((error: unknown) => {
            console.error(error);
          });
        }}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
        </TabsList>

        <Outlet />
      </Tabs>
    </section>
  );
}

function GameEntryStatusButton({
  onOpen,
  onStatusSelect,
  status,
}: {
  onOpen: () => void;
  onStatusSelect: (status: GameEntryStatus) => void;
  status: GameEntryStatus;
}) {
  return (
    <div className="inline-flex rounded-lg shadow-sm">
      <Button className="border-r-primary-foreground/20 rounded-r-none" onClick={onOpen}>
        <Gamepad2 data-icon="inline-start" />
        {GAME_ENTRY_STATUS_LABELS[status]}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={statusMenuTriggerButton}>
          <ChevronDown data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-44" align="start">
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={status}
              onValueChange={(value) => {
                if (isGameEntryStatus(value)) {
                  onStatusSelect(value);
                }
              }}
            >
              {GAME_ENTRY_STATUSES.map((item) => (
                <DropdownMenuRadioItem key={item} value={item}>
                  {GAME_ENTRY_STATUS_LABELS[item]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getGameTabPath(value: string) {
  if (value === "related") {
    return "/games/$slug/related" as const;
  }

  if (value === "community") {
    return "/games/$slug/community" as const;
  }

  return "/games/$slug/overview" as const;
}

function useActiveGameTab(): GameTab {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname.endsWith("/related")) {
    return "related";
  }

  if (pathname.endsWith("/community")) {
    return "community";
  }

  return "overview";
}

function GameEntryActionLoading() {
  return (
    <div
      className="bg-background/70 border-border/70 mt-6 inline-flex rounded-lg border p-1 backdrop-blur"
      aria-label="Loading library entry"
    >
      <div className="bg-muted h-8 w-28 animate-pulse rounded-md" />
      <div className="bg-muted ml-1 h-8 w-9 animate-pulse rounded-md" />
    </div>
  );
}

export function OverviewTab({ game }: { game: IgdbGamePage }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Game Info">
        <InfoRows game={game} />
      </Panel>

      <FriendsActivityPanel />

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

      <SimilarGames game={game} />
    </div>
  );
}

function FriendsActivityPanel() {
  return (
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
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">{activity.time}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SimilarGames({ game }: { game: IgdbGamePage }) {
  return (
    <Panel title="Similar Games">
      {game.similarGames.length > 0 ? (
        <GameCardGrid games={game.similarGames.slice(0, 6)} />
      ) : (
        <EmptyState>No similar games returned yet.</EmptyState>
      )}
    </Panel>
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

export function Panel({
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
  const rows: {
    label: string;
    value: ReactNode;
    icon: LucideIcon;
  }[] = [
    { label: "Release Date", value: game.releaseDate, icon: CalendarDays },
    { label: "Developer", value: game.developers.join(", ") || "Unknown", icon: Gamepad2 },
    { label: "Publisher", value: game.publishers.join(", ") || "Unknown", icon: Library },
    { label: "Engine", value: formatList(game.gameEngines), icon: Wrench },
    { label: "Platforms", value: <PlatformBadges platforms={game.platforms} />, icon: Gamepad2 },
    { label: "Game Modes", value: formatList(game.gameModes), icon: Gauge },
    { label: "Perspective", value: formatList(game.playerPerspectives), icon: MousePointer2 },
    { label: "Themes", value: formatList(game.themes), icon: Tags },
    {
      label: "IGDB Rating",
      value: formatScoreWithCount(game.rating, game.ratingCount),
      icon: Star,
    },
    {
      label: "Critic Rating",
      value: formatScoreWithCount(game.aggregatedRating, game.aggregatedRatingCount),
      icon: Star,
    },
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

function formatList(items: string[]) {
  return items.join(", ") || "Unknown";
}

function PlatformBadges({ platforms }: { platforms: string[] }) {
  if (platforms.length === 0) {
    return <span>Unknown</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {platforms.map((platform) => {
        const Icon = getPlatformIcon(platform);

        return (
          <Badge key={platform} variant="secondary" title={platform} className="h-6 gap-1.5">
            <Icon aria-hidden="true" />
            <span>{platform}</span>
          </Badge>
        );
      })}
    </div>
  );
}

function getPlatformIcon(platform: string): PlatformIcon {
  const normalizedPlatform = platform.toLowerCase();

  if (normalizedPlatform.includes("playstation") || /^ps\d/.test(normalizedPlatform)) {
    return Playstation;
  }

  if (
    normalizedPlatform.includes("xbox") ||
    normalizedPlatform === "x360" ||
    normalizedPlatform === "xone" ||
    normalizedPlatform === "series x|s" ||
    normalizedPlatform === "series x/s"
  ) {
    return Xbox;
  }

  if (normalizedPlatform.includes("stadia")) {
    return Google;
  }

  if (normalizedPlatform.includes("steam")) {
    return Steam;
  }

  if (
    normalizedPlatform === "pc" ||
    normalizedPlatform.includes("windows") ||
    normalizedPlatform.includes("win")
  ) {
    return Windows;
  }

  if (
    normalizedPlatform.includes("mac") ||
    normalizedPlatform.includes("ios") ||
    normalizedPlatform.includes("iphone") ||
    normalizedPlatform.includes("ipad")
  ) {
    return AppleDark;
  }

  if (normalizedPlatform.includes("linux")) {
    return Linux;
  }

  if (normalizedPlatform.includes("epic")) {
    return EpicgamesIconDark;
  }

  return Gamepad2;
}

export function EmptyState({ children }: { children: ReactNode }) {
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
            to="/games/$slug/overview"
            params={{ slug: "the-witcher-3-wild-hunt" }}
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

function formatScoreWithCount(score: number | null, count: number | null) {
  if (score === null) {
    return "N/A";
  }

  return count === null ? String(score) : `${score} (${count.toLocaleString()} ratings)`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

function getSaveErrorMessage(error: unknown) {
  if (isAuthRequiredError(error)) {
    return "Could not save your library entry because the game library is not authenticated. Refresh the page or sign in with Twitch again.";
  }

  return `Could not save your library entry. ${getErrorMessage(error)}`;
}

function isAuthRequiredError(error: unknown) {
  return getErrorMessage(error).includes("Authentication is required");
}

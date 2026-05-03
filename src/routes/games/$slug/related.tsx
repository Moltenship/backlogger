import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { GameCardGrid } from "@/components/game-card-grid";
import { buttonVariants } from "@/components/ui/button";
import type { IgdbRelatedGame, IgdbRelatedGameGroup } from "@/lib/igdb";
import { relatedFranchiseGamesQueryOptions } from "@/lib/igdb-query";
import { EmptyState, Panel } from "@/routes/games/$slug";

interface RelatedSearch {
  page: number;
}

export const Route = createFileRoute("/games/$slug/related")({
  validateSearch: (search: Record<string, unknown>): RelatedSearch => ({
    page: Math.max(1, Number(search.page) || 1),
  }),
  loaderDeps: ({ search }) => ({
    page: search.page,
  }),
  loader: ({ context, deps, params }) =>
    context.queryClient.ensureQueryData(
      relatedFranchiseGamesQueryOptions({
        page: deps.page,
        slug: params.slug,
      }),
    ),
  component: GameRelatedPage,
});

function GameRelatedPage() {
  const { slug } = Route.useParams();
  const { page } = Route.useSearch();
  const { data } = useSuspenseQuery(relatedFranchiseGamesQueryOptions({ page, slug }));

  if (data.error) {
    return <EmptyState>{data.error}</EmptyState>;
  }

  if (!data.related) {
    return <EmptyState>Related games are not available.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-4">
      {data.related.groups.map((group) => (
        <RelatedGroup key={group.key} group={group} />
      ))}

      <Panel title={data.related.franchiseName ?? "Franchise Games"}>
        <div className="flex flex-col gap-4">
          {data.related.games.length > 0 ? (
            <RelatedGameGrid games={data.related.games} />
          ) : (
            <EmptyState>No other games were found for this franchise.</EmptyState>
          )}

          <RelatedPagination
            slug={slug}
            page={data.related.page}
            hasNextPage={data.related.hasNextPage}
          />
        </div>
      </Panel>
    </div>
  );
}

function RelatedGroup({ group }: { group: IgdbRelatedGameGroup }) {
  return (
    <Panel title={group.title}>
      <div className="flex flex-col gap-4">
        <RelatedGameGrid games={group.games} />
      </div>
    </Panel>
  );
}

function RelatedGameGrid({ games }: { games: IgdbRelatedGame[] }) {
  return <GameCardGrid games={games} />;
}

function RelatedPagination({
  hasNextPage,
  page,
  slug,
}: {
  hasNextPage: boolean;
  page: number;
  slug: string;
}) {
  if (page === 1 && !hasNextPage) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link
          to="/games/$slug/related"
          params={{ slug }}
          search={{ page: page - 1 }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Link>
      ) : (
        <span />
      )}

      <span className="text-muted-foreground text-sm">Page {page}</span>

      {hasNextPage ? (
        <Link
          to="/games/$slug/related"
          params={{ slug }}
          search={{ page: page + 1 }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Next
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { gameQueryOptions } from "@/lib/igdb-query";
import { OverviewTab } from "@/routes/games/$slug";

export const Route = createFileRoute("/games/$slug/overview")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(gameQueryOptions(params.slug)),
  component: GameOverviewPage,
});

function GameOverviewPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(gameQueryOptions(slug));

  if (!data.game) {
    return null;
  }

  return <OverviewTab game={data.game} />;
}

import { queryOptions } from "@tanstack/react-query";

import { getIgdbGame, getIgdbRelatedFranchiseGames } from "@/lib/igdb-server";

export function gameQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["igdb", "game", slug],
    queryFn: () => getIgdbGame({ data: { slug } }),
    staleTime: 5 * 60_000,
  });
}

export function relatedFranchiseGamesQueryOptions({ page, slug }: { page: number; slug: string }) {
  return queryOptions({
    queryKey: ["igdb", "game", slug, "related-franchise-games", page],
    queryFn: () => getIgdbRelatedFranchiseGames({ data: { page, slug } }),
    staleTime: 5 * 60_000,
  });
}

import { queryOptions } from "@tanstack/react-query";

import { getIgdbGame } from "@/lib/igdb-server";

export function gameQueryOptions(gameId: string) {
  return queryOptions({
    queryKey: ["igdb", "game", gameId],
    queryFn: () => getIgdbGame({ data: { gameId } }),
    staleTime: 5 * 60_000,
  });
}

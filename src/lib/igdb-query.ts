import { queryOptions } from "@tanstack/react-query";

import { getIgdbGame } from "@/lib/igdb-server";

export function gameQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["igdb", "game", slug],
    queryFn: () => getIgdbGame({ data: { slug } }),
    staleTime: 5 * 60_000,
  });
}

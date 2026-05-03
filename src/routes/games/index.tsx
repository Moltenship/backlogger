import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/games/")({
  loader: () => {
    throw redirect({
      to: "/games/$gameId",
      params: { gameId: "1942" },
    });
  },
});

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/games/$slug/community")({
  component: GameCommunityPage,
});

function GameCommunityPage() {
  return null;
}

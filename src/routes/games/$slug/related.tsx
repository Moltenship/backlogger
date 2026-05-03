import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/games/$slug/related")({
  component: GameRelatedPage,
});

function GameRelatedPage() {
  return null;
}

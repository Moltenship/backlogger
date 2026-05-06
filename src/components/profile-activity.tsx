import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import {
  formatActivityMessage,
  type GameEntryActivityBucket,
  type GameEntryProfileActivity,
} from "@/lib/game-entry";

const heatmapDayCount = 35;
const dayInMs = 86_400_000;

export function ProfileActivity({ activity }: { activity: GameEntryProfileActivity }) {
  return (
    <section className="border-border/70 bg-card rounded-lg border p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="size-4" />
        <h2 className="text-sm font-semibold">Activity</h2>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <ActivityStat label="Recent active days" value={activity.summary.recentActiveDays} />
        <ActivityStat label="Recent status updates" value={activity.summary.recentStatusUpdates} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Latest {activity.summary.recentActivityLimit} status updates scanned
          </p>
        </div>
        <ActivityHeatmap buckets={activity.heatmap} />
      </div>

      <div className="mt-5 space-y-3">
        {activity.recent.length > 0 ? (
          activity.recent.map((item) => (
            <Link
              key={item.id}
              to="/games/$slug/overview"
              params={{ slug: item.slug }}
              className="hover:bg-accent flex items-center gap-3 rounded-md p-2 transition"
            >
              <div className="bg-muted size-10 overflow-hidden rounded-md">
                {item.coverUrl ? (
                  <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{formatActivityMessage(item)}</p>
                <p className="text-muted-foreground text-xs">{item.dayKey}</p>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">Status updates will appear here.</p>
        )}
      </div>
    </section>
  );
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border/70 bg-background rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ActivityHeatmap({ buckets }: { buckets: GameEntryActivityBucket[] }) {
  const countByDay = new Map(buckets.map((bucket) => [bucket.dayKey, bucket.count]));
  const dayKeys = buildRecentDayKeys(heatmapDayCount);
  const maxCount = Math.max(1, ...dayKeys.map((dayKey) => countByDay.get(dayKey) ?? 0));

  return (
    <div className="flex flex-wrap gap-1" aria-label="Recent status activity by day">
      {dayKeys.map((dayKey) => {
        const count = countByDay.get(dayKey) ?? 0;
        const label = `${count} ${count === 1 ? "status update" : "status updates"} on ${dayKey}`;

        return (
          <time
            key={dayKey}
            dateTime={dayKey}
            title={label}
            aria-label={label}
            className={`size-3 rounded-[3px] border ${getHeatmapColor(count, maxCount)}`}
          />
        );
      })}
    </div>
  );
}

function buildRecentDayKeys(dayCount: number) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Array.from({ length: dayCount }, (_, index) => {
    const offset = dayCount - index - 1;

    return new Date(todayUtc - offset * dayInMs).toISOString().slice(0, 10);
  });
}

function getHeatmapColor(count: number, maxCount: number) {
  if (count === 0) {
    return "border-border/60 bg-muted/50";
  }

  const intensity = count / Math.max(maxCount, 1);

  if (intensity <= 0.33) {
    return "border-primary/20 bg-primary/25";
  }

  if (intensity <= 0.66) {
    return "border-primary/40 bg-primary/50";
  }

  return "border-primary/70 bg-primary";
}

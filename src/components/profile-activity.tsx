import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import {
  formatActivityMessage,
  type GameEntryActivityBucket,
  type GameEntryProfileActivity,
} from "@/lib/game-entry";

const heatmapDayCount = 35;
const dayInMs = 86_400_000;
const activityDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function ProfileActivity({ activity }: { activity: GameEntryProfileActivity }) {
  return (
    <section className="border-border/70 bg-card rounded-lg border p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="size-4" aria-hidden="true" />
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
        <ActivityHeatmap buckets={activity.heatmap} endDayKey={getActivityEndDayKey(activity)} />
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
                <time className="text-muted-foreground text-xs" dateTime={item.dayKey}>
                  {formatDayLabel(item.dayKey)}
                </time>
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

function ActivityHeatmap({
  buckets,
  endDayKey,
}: {
  buckets: GameEntryActivityBucket[];
  endDayKey: string;
}) {
  const bucketMap = new Map(buckets.map((bucket) => [bucket.dayKey, bucket.count]));
  const days = buildRecentDayKeys(heatmapDayCount, endDayKey);
  const daySummaries = days.map((dayKey) => {
    const count = bucketMap.get(dayKey) ?? 0;

    return {
      count,
      dayKey,
      label: formatActivityDaySummary(dayKey, count),
    };
  });
  const maxCount = Math.max(1, ...daySummaries.map((day) => day.count));

  return (
    <>
      <div className="flex flex-wrap gap-1" aria-hidden="true">
        {daySummaries.map(({ count, dayKey, label }) => (
          <time
            key={dayKey}
            dateTime={dayKey}
            title={label}
            className={`size-3 rounded-[3px] border ${getHeatmapColor(count, maxCount)}`}
          />
        ))}
      </div>
      <div className="sr-only">
        <p>Recent status activity by day</p>
        <ul>
          {daySummaries.map(({ dayKey, label }) => (
            <li key={dayKey}>{label}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

function buildRecentDayKeys(dayCount: number, endDayKey: string) {
  const endDayUtc = Date.parse(`${endDayKey}T00:00:00.000Z`);

  return Array.from({ length: dayCount }, (_, index) => {
    const offset = dayCount - index - 1;

    return new Date(endDayUtc - offset * dayInMs).toISOString().slice(0, 10);
  });
}

function getActivityEndDayKey(activity: GameEntryProfileActivity) {
  const latestHeatmapDay = getLatestDayKey(activity.heatmap.map((bucket) => bucket.dayKey));
  const latestRecentDay = getLatestDayKey(activity.recent.map((item) => item.dayKey));

  if (latestHeatmapDay && latestRecentDay) {
    return latestHeatmapDay > latestRecentDay ? latestHeatmapDay : latestRecentDay;
  }

  if (latestHeatmapDay) {
    return latestHeatmapDay;
  }

  if (latestRecentDay) {
    return latestRecentDay;
  }

  return getTodayUtcDayKey();
}

function getLatestDayKey(dayKeys: string[]) {
  return dayKeys.reduce<string | null>((latestDayKey, dayKey) => {
    if (latestDayKey === null || dayKey > latestDayKey) {
      return dayKey;
    }

    return latestDayKey;
  }, null);
}

function getTodayUtcDayKey() {
  const today = new Date();

  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function formatActivityDaySummary(dayKey: string, count: number) {
  const statusUpdateText = count === 1 ? "status update" : "status updates";

  return `${formatDayLabel(dayKey)}: ${count} ${statusUpdateText}`;
}

function formatDayLabel(dayKey: string) {
  return activityDateFormatter.format(Date.parse(`${dayKey}T00:00:00.000Z`));
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

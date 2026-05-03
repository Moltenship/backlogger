import { Star } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  GAME_ENTRY_STATUS_LABELS,
  GAME_ENTRY_STATUSES,
  type GameEntryStatus,
  normalizeReview,
} from "@/lib/game-entry";

const STAR_VALUES = Array.from({ length: 5 }, (_, index) => index + 1);

export interface GameEntryFormValue {
  status: GameEntryStatus;
  rating: number | null;
  review: string | null;
}

export function GameEntryForm({
  initialValue,
  isAuthenticated,
  isSaving,
  onSignIn,
  onSubmit,
}: {
  initialValue: GameEntryFormValue | null;
  isAuthenticated: boolean;
  isSaving: boolean;
  onSignIn: () => void;
  onSubmit: (value: GameEntryFormValue) => void;
}) {
  const ratingGroupId = useId();
  const reviewId = useId();
  const initialStatus = initialValue?.status ?? "backlog";
  const initialRating = initialValue?.rating ?? null;
  const initialReview = initialValue?.review ?? "";
  const [status, setStatus] = useState<GameEntryStatus>(initialStatus);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [review, setReview] = useState(initialReview);

  useEffect(() => {
    setStatus(initialStatus);
    setRating(initialRating);
    setReview(initialReview);
  }, [initialStatus, initialRating, initialReview]);

  return (
    <form
      className="bg-background/70 border-border/70 mt-6 max-w-2xl rounded-lg border p-3 backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault();

        if (!isAuthenticated) {
          onSignIn();
          return;
        }

        onSubmit({
          status,
          rating,
          review: normalizeReview(review),
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            name="status"
            autoComplete="off"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as GameEntryStatus);
            }}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
          >
            {GAME_ENTRY_STATUSES.map((item) => (
              <option key={item} value={item}>
                {GAME_ENTRY_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-1 text-sm">
          <span id={ratingGroupId} className="text-muted-foreground">
            Rating
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <div
              role="radiogroup"
              aria-labelledby={ratingGroupId}
              className="flex flex-wrap items-center gap-1"
            >
              {STAR_VALUES.map((value) => (
                <span key={value} className="text-muted-foreground relative block size-6">
                  <Star className="absolute inset-1 size-4 fill-current" aria-hidden="true" />
                  <span
                    className="text-primary pointer-events-none absolute inset-1 size-4"
                    style={{ clipPath: `inset(0 ${100 - getStarFillPercent(rating, value)}% 0 0)` }}
                    aria-hidden="true"
                  >
                    <Star className="size-4 fill-current" />
                  </span>
                  <label className="absolute inset-y-0 left-0 w-1/2 cursor-pointer rounded-l-sm">
                    <input
                      type="radio"
                      name="rating"
                      value={value - 0.5}
                      checked={rating === value - 0.5}
                      onChange={() => {
                        setRating(value - 0.5);
                      }}
                      className="sr-only"
                      aria-label={formatRatingLabel(value - 0.5)}
                      autoComplete="off"
                    />
                    <span className="sr-only">{formatRatingLabel(value - 0.5)}</span>
                  </label>
                  <label className="absolute inset-y-0 right-0 w-1/2 cursor-pointer rounded-r-sm">
                    <input
                      type="radio"
                      name="rating"
                      value={value}
                      checked={rating === value}
                      onChange={() => {
                        setRating(value);
                      }}
                      className="sr-only"
                      aria-label={formatRatingLabel(value)}
                      autoComplete="off"
                    />
                    <span className="sr-only">{formatRatingLabel(value)}</span>
                  </label>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <label htmlFor={reviewId} className="mt-3 grid gap-1 text-sm">
        <span className="text-muted-foreground">Review</span>
        <textarea
          id={reviewId}
          name="review"
          autoComplete="off"
          value={review}
          onChange={(event) => {
            setReview(event.target.value);
          }}
          rows={3}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          placeholder="Optional notes or review"
        />
      </label>

      <div className="mt-3 flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isAuthenticated ? "Save" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}

function getStarFillPercent(rating: number | null, starValue: number) {
  if (rating === null || rating <= starValue - 1) {
    return 0;
  }

  if (rating >= starValue) {
    return 100;
  }

  return 50;
}

function formatRatingLabel(value: number) {
  return `${value} star${value === 1 ? "" : "s"}`;
}

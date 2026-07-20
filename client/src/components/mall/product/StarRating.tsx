import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md";
  className?: string;
}

export function StarRating({ rating, size = "sm", className }: StarRatingProps) {
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating}점`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating;
        return (
          <Star
            key={index}
            className={cn(iconClass, filled ? "fill-amber-400 text-amber-400" : "text-neutral-300")}
          />
        );
      })}
    </span>
  );
}

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        return (
          <button
            key={star}
            type="button"
            className="p-0.5"
            aria-label={`${star}점`}
            onClick={() => onChange(star)}
          >
            <Star
              className={cn(
                "w-5 h-5",
                star <= value ? "fill-amber-400 text-amber-400" : "text-neutral-300",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

import { useMemo, useState } from "react";
import { FoodIcon } from "./food-icon";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
  roundedPlaceholder?: boolean;
  priority?: boolean;
  emoji?: string;
  foodName?: string;
  textSizeClass?: string;
};

function isUsableUrl(value?: string | null) {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  if (lower.startsWith("data:image/") || lower.startsWith("blob:")) return true;
  if (!lower.startsWith("http")) return false;
  // Only the user's own scanner snapshots (uploaded to scan-photos) or Supabase storage photos should
  // ever render. Every other source (web product images, AI-resolved photos,
  // legacy foto_url values) is intentionally hidden — cards show the icon.
  return (
    lower.includes("/scan-photos/") || lower.includes("supabase.co") || lower.includes("storage")
  );
}

export function FoodImage({
  src,
  alt,
  className = "",
  eager = false,
  roundedPlaceholder: _roundedPlaceholder = true,
  priority: _priority = false,
  emoji,
  foodName,
  textSizeClass,
}: Props) {
  // Only show an actual image when a usable URL is provided directly (e.g. a
  // scanner snapshot uploaded to scan-photos). Otherwise render the specific
  // food emoji — with guaranteed fallback consistency.
  const initialUrl = useMemo(() => (isUsableUrl(src) ? src! : null), [src]);
  const [broken, setBroken] = useState(false);

  if (!initialUrl || broken) {
    return (
      <div className={`bg-secondary/30 flex items-center justify-center select-none ${className}`}>
        <FoodIcon
          name={foodName || alt}
          emoji={emoji}
          sizeClassName={
            textSizeClass || "text-3xl sm:text-4xl drop-shadow-sm select-none leading-none"
          }
          ariaLabel={alt}
        />
      </div>
    );
  }

  return (
    <img
      src={initialUrl}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`object-cover ${className}`}
      onError={() => setBroken(true)}
    />
  );
}

import { useMemo, useState } from "react";
import { Utensils } from "lucide-react";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
  roundedPlaceholder?: boolean;
  priority?: boolean;
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
}: Props) {
  // Only show an actual image when a usable URL is provided directly (e.g. a
  // scanner snapshot uploaded to scan-photos). Otherwise render a discreet
  // placeholder icon — we no longer auto-resolve product images from the web.
  const initialUrl = useMemo(() => (isUsableUrl(src) ? src! : null), [src]);
  const [broken, setBroken] = useState(false);

  if (!initialUrl || broken) {
    return (
      <div
        className={`bg-card/60 border border-border flex items-center justify-center text-muted-foreground ${className}`}
      >
        <Utensils className="size-1/3" strokeWidth={1.5} />
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

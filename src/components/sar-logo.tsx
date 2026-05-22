export function SarLogo({
  size = "lg",
  align = "center",
}: {
  size?: "sm" | "md" | "lg";
  align?: "left" | "center";
}) {
  const sizes = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-5xl",
  };

  return (
    <div className={`flex items-center gap-3 ${align === "center" ? "flex-col" : "flex-row"}`}>
      {/* Circle Icon similarly stylized */}
      <img
        src="https://qqrynovbilducybxmlcj.supabase.co/storage/v1/object/public/avatars/faaeddb7-632c-4d95-b799-97992370a248/avatar-1778290824058.jpeg"
        alt="Logo"
        className="size-10 rounded-full object-cover shadow-[0_0_20px_rgba(255,255,255,0.2)]"
      />

      <div className={`flex flex-col ${align === "center" ? "items-center" : "items-start"}`}>
        <h1
          className={`font-display font-black tracking-tighter text-foreground ${sizes[size]} leading-none`}
        >
          sar.scan
        </h1>
        {size !== "sm" && (
          <span className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground/60 font-black">
            Architecture of Nutri
          </span>
        )}
      </div>
    </div>
  );
}

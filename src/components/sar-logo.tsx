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
      <div className="size-10 rounded-full bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
        <span className="text-black text-sm font-black tracking-tighter">S</span>
      </div>

      <div className={`flex flex-col ${align === "center" ? "items-center" : "items-start"}`}>
        <h1
          className={`font-display font-black tracking-tighter text-white ${sizes[size]} leading-none`}
        >
          sar.scan
        </h1>
        {size !== "sm" && (
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/30 font-black">
            Architecture of Nutri
          </span>
        )}
      </div>
    </div>
  );
}

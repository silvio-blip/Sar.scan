import React from "react";

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  width = "100%",
  height = "auto",
  borderRadius = 28,
  className = "",
  style = {},
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-white/90 dark:bg-[#121915]/90 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg transform-gpu transition-all ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: `${borderRadius}px`,
        ...style,
      }}
    >
      <div className="w-full h-full p-2 flex items-center justify-around">{children}</div>
    </div>
  );
};

export default GlassSurface;

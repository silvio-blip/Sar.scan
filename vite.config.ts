import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["VITE_", "SUPABASE_"]);

  return {
    plugins: [TanStackRouterVite(), react(), tsConfigPaths(), tailwindcss()],
    envPrefix: ["VITE_", "SUPABASE_"],
    define: {
      "process.env.SUPABASE_URL": JSON.stringify(
        process.env.SUPABASE_URL || env.SUPABASE_URL || "",
      ),
      "process.env.SUPABASE_SERVICE_ROLE_KEY": JSON.stringify(
        process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "",
      ),
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
    },
  };
});

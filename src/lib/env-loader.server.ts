import fs from "fs";
import path from "path";

let envLoaded = false;

export function loadEnv() {
  if (envLoaded) return;
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const firstEquals = trimmed.indexOf("=");
          const key = trimmed.substring(0, firstEquals).trim();
          let value = trimmed.substring(firstEquals + 1).trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.substring(1, value.length - 1);
          }
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      console.log("[EnvLoader] Variáveis carregadas do arquivo .env com sucesso!");
    }
  } catch (err) {
    console.warn("[EnvLoader] Erro ao carregar o arquivo .env:", err);
  }
  envLoaded = true;
}

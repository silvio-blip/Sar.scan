import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// Logic from edge-proxy and stripe functions
// Since we want to keep it simple, we'll import the logic directly if possible or copy it.
// To avoid complex restructuring, I'll define the API routes here and use the logic from the existing files.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS middleware for all development, staging and production origins
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, stripe-signature");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));

  // API Routes

  // Proxy for invokeEdge
  app.post("/api/edge", async (req, res) => {
    try {
      // Lazy import to avoid issues during build/dev
      const { invokeEdgeInternal } = await import("./src/lib/edge-proxy.server.ts");
      const result = await invokeEdgeInternal(req.body);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Proxy for stripe checkout
  app.post("/api/stripe/checkout", async (req, res) => {
    try {
      const { createStripeCheckoutInternal } = await import("./src/lib/stripe.server.ts");
      const result = await createStripeCheckoutInternal(req.body);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/stripe/sync", async (req, res) => {
    try {
      const { syncStripePlansInternal } = await import("./src/lib/stripe.server.ts");
      const result = await syncStripePlansInternal(req.body);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  // Stripe Webhook
  app.post(
    "/api/public/stripe-webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const sig = req.headers["stripe-signature"] as string;
        const { handleStripeWebhook } = await import("./src/lib/stripe.webhook.ts");
        const result = await handleStripeWebhook(req.body.toString(), sig);
        res.send(result);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        console.error("[Webhook Error]", msg);
        res.status(500).send(msg);
      }
    },
  );

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createFinanceMockRouter } from "./finance-api.mock";
import { createFluxAiRouter } from "./flux-ai-api";
import { createFluxAgentRouter } from "./flux-agent-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json());
  app.use("/api", createFluxAiRouter());
  app.use("/api", createFluxAgentRouter());
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/v1", createFinanceMockRouter());
  }

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

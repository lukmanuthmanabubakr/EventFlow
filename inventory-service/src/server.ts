import "dotenv/config";
// server.ts
//
// Inventory Service entry point. Serves the OpenAPI/Scalar docs, the
// health check, and mounts the real product routes.

import express, { Request, Response } from "express";
import { apiReference } from "@scalar/express-api-reference";
import YAML from "yamljs";
import path from "path";
import productsRouter from "./routes/products.routes";

const app = express();
const PORT = process.env.PORT || 5005;

app.use(express.json());

const openapiDocument = YAML.load(path.join(__dirname, "../openapi.yaml"));

app.use(
  "/docs",
  apiReference({
    spec: { content: openapiDocument },
  })
);

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use(productsRouter);

app.listen(PORT, () => {
  console.log(`Inventory Service running on http://localhost:${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/docs`);
});

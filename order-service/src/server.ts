import "dotenv/config";
// server.ts
//
// Order Service entry point. Serves the OpenAPI/Scalar docs, the health
// check, connects to RabbitMQ, and mounts the real order routes.

import express, { Request, Response } from "express";
import { apiReference } from "@scalar/express-api-reference";
import YAML from "yamljs";
import path from "path";
import { connectRabbitMQ } from "./config/rabbitmq";
import ordersRouter from "./routes/orders.routes";

const app = express();
const PORT = process.env.PORT || 5004;

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

app.use(ordersRouter);

async function start() {
  await connectRabbitMQ();

  app.listen(PORT, () => {
    console.log(`Order Service running on http://localhost:${PORT}`);
    console.log(`API docs available at http://localhost:${PORT}/docs`);
  });
}

start().catch((err) => {
  console.error("Failed to start Order Service:", err);
  process.exit(1);
});

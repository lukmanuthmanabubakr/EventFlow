// server.js
//
// Minimal scaffolding for Week 1 — just enough to serve the OpenAPI spec
// and a health check. Real routes get added here starting Week 4.

const express = require("express");
const { apiReference } = require("@scalar/express-api-reference");
const YAML = require("yamljs");

const app = express();
const PORT = process.env.PORT || 5006;

const openapiDocument = YAML.load("./openapi.yaml");

app.use(
  "/docs",
  apiReference({
    spec: { content: openapiDocument },
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Notification Service running on http://localhost:${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/docs`);
});

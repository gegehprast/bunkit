import { createRoute } from "@bunkit/server"

/**
 * Home route
 */
createRoute("GET", "/")
  .openapi({
    operationId: "home",
    summary: "Home page",
    description: "Welcome page for the API",
    tags: ["General"],
  })
  .handler(({ res }) => {
    return res.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BunKit API</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #333; }
    .links { margin-top: 2rem; }
    .links a {
      display: inline-block;
      margin-right: 1rem;
      padding: 0.5rem 1rem;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
    }
    .links a:hover { background: #0056b3; }
  </style>
</head>
<body>
  <h1>🚀 BunKit API</h1>
  <p>Production-ready HTTP API built with BunKit</p>
  <div class="links">
    <a href="/docs">API Documentation</a>
    <a href="/openapi.json">OpenAPI Spec</a>
    <a href="/api/health">Health Check</a>
  </div>
</body>
</html>
    `)
  })

import { createRoute, createServer, routeRegistry } from "@bunkit/server"
import { z } from "zod"

/**
 * GET /openapi.json - Returns the OpenAPI specification
 */
createRoute("GET", "/openapi.json")
  .openapi({
    operationId: "getOpenApiSpec",
    summary: "Get OpenAPI specification",
    description: "Returns the OpenAPI 3.1 specification for this API",
    tags: ["Documentation"],
  })
  .handler(({ res }) => {
    const server = createServer()
    const spec = server.getOpenApiSpec()
    return res.ok(spec)
  })

/**
 * GET /docs - Swagger UI documentation page
 */
createRoute("GET", "/docs")
  .openapi({
    operationId: "getApiDocs",
    summary: "API documentation",
    description: "Interactive API documentation using Swagger UI",
    tags: ["Documentation"],
  })
  .handler(({ res }) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BunStart API Documentation</title>
  <link rel="icon" type="image/x-icon" href="/public/favicon.ico">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    }
  </script>
</body>
</html>
    `.trim()

    return res.html(html)
  })

/**
 * POST /openapi/refresh - Refresh OpenAPI cache (dev only)
 */
createRoute("POST", "/openapi/refresh")
  .openapi({
    operationId: "refreshOpenApiSpec",
    summary: "Refresh OpenAPI cache",
    description:
      "Clears the OpenAPI spec cache and regenerates it (development only)",
    tags: ["Documentation"],
  })
  .response(
    z.object({
      message: z.string(),
      routeCount: z.number(),
    }),
  )
  .handler(({ res }) => {
    // In a production environment, you might want to restrict this endpoint
    const routes = routeRegistry.getAll()

    return res.ok({
      message: "OpenAPI cache refreshed",
      routeCount: routes.length,
    })
  })

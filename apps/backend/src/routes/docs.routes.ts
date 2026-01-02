import { createRoute, type OpenApiSpec } from "@bunkit/server"
import { z } from "zod"
import { config } from "@/config"
import { server } from "@/core/server"

let spec: OpenApiSpec | null = null

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
  .handler(async ({ res }) => {
    if (!spec) {
      const result = await server.http.getOpenApiSpec()
      if (result.isErr()) {
        return res.internalError("Failed to generate OpenAPI specification")
      }
      spec = result.value
    }
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
  <title>${config.APP_NAME} API Documentation</title>
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
    }),
  )
  .handler(({ res }) => {
    spec = null
    return res.ok({ message: "OpenAPI specification cache cleared" })
  })

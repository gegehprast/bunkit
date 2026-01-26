import { join } from "node:path"
import { createRoute } from "@bunkit/server"

/**
 * Static file serving
 * Supports nested paths like /public/images/logo.png
 */
createRoute("GET", "/public/:path*")
  .openapi({
    operationId: "getStaticFile",
    summary: "Get static file",
    description: "Serves static files from the public directory",
    tags: ["Static"],
  })
  .handler(async ({ params, res }) => {
    const publicDir = join(import.meta.dir, "../../public")
    const filePath = join(publicDir, params.path)

    // Prevent directory traversal
    if (!filePath.startsWith(publicDir)) {
      return res.forbidden("Access denied")
    }

    const file = Bun.file(filePath)
    const exists = await file.exists()

    if (!exists) {
      return res.notFound("File not found")
    }

    // Return file as Response
    return new Response(file)
  })

import { join } from "node:path"
import { createRoute } from "@bunkit/server"

/**
 * Static file serving
 * Supports nested paths like /public/images/logo.png
 */
createRoute("GET", "/:path*")
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

    // Use built-in file helper (handles existence check and content-type)
    return res.file(filePath)
  })

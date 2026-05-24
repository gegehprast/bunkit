import path, { join } from "node:path"
import { createRoute, type ResponseBuilder } from "@bunkit/server"
import { config } from "@/config"
import { APP_ASSETS_DIR } from "@/config/app-root"

const publicDir = path.isAbsolute(config.PUBLIC_DIR)
  ? config.PUBLIC_DIR
  : path.resolve(APP_ASSETS_DIR, config.PUBLIC_DIR)

const frontendDir = path.isAbsolute(config.FRONTEND_DIR)
  ? config.FRONTEND_DIR
  : path.resolve(APP_ASSETS_DIR, config.FRONTEND_DIR)

/**
 * Static asset serving.
 * - Serves any file found under PUBLIC_DIR.
 * - Falls back to FRONTEND_DIR/index.html for SPA client-side routing.
 */
async function handleStaticRequest(
  requestedPath: string,
  res: ResponseBuilder,
) {
  const filePath = join(publicDir, requestedPath)

  // Prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    return res.forbidden("Access denied")
  }

  // Try PUBLIC_DIR first
  const file = Bun.file(filePath)
  if (await file.exists()) {
    return res.file(filePath)
  }

  // Try FRONTEND_DIR (assets use absolute paths from root, e.g. /assets/...)
  const frontendFilePath = join(frontendDir, requestedPath)
  if (frontendFilePath.startsWith(frontendDir)) {
    const frontendFile = Bun.file(frontendFilePath)
    if (await frontendFile.exists()) {
      return res.file(frontendFilePath)
    }
  }

  // SPA fallback: serve index.html for any unmatched route
  const indexPath = join(frontendDir, "index.html")
  const indexFile = Bun.file(indexPath)
  if (await indexFile.exists()) {
    return res.file(indexPath)
  }

  return res.notFound("Not found")
}

createRoute("GET", "/")
  .excludeFromDocs()
  .handler(({ res }) => handleStaticRequest("", res))

createRoute("GET", "/:path*")
  .excludeFromDocs()
  .handler(({ params, res }) => handleStaticRequest(params.path ?? "", res))

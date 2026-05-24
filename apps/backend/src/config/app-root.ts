import path from "node:path"

/**
 * The root directory where runtime assets (drizzle/, public/) live.
 *
 * - Compiled binary: process.execPath = path to the compiled binary → dirname gives dist/
 * - Source mode:     import.meta.dir = apps/backend/src/config — go up 2 levels to apps/backend/
 *
 * Detection: compiled Bun binaries use the virtual FS scheme "/$bunfs/".
 */
const isBinary = import.meta.url.includes("$bunfs")

export const APP_ASSETS_DIR = isBinary
  ? path.dirname(process.execPath)
  : path.resolve(import.meta.dir, "../..")

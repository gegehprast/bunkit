#!/usr/bin/env bun

/**
 * Build script for producing a single-binary release of hookitup.
 *
 * Output layout (dist/):
 *   hookitup   — compiled Bun binary (self-contained JS runtime + app code)
 *   drizzle/   — SQL migration files (read at runtime)
 *   public/    — static files served at root (favicon, etc.)
 *   webui/     — frontend SPA static files (served at /webui/)
 *
 * Usage:
 *   bun run build
 */

import { cp, mkdir, rm } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "..")
const BACKEND = path.join(ROOT, "apps/backend")
const FRONTEND = path.join(ROOT, "apps/frontend")
const DIST = path.join(ROOT, "dist")

async function spawn(cmd: string[], cwd: string): Promise<void> {
  console.log(`\n$ ${cmd.join(" ")}  (cwd: ${path.relative(ROOT, cwd) || "."})`)
  const proc = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`Command exited with code ${code}: ${cmd.join(" ")}`)
  }
}

async function main() {
  console.log("🏗️  Building hookitup single binary...\n")

  // Step 1: Build frontend
  console.log("📦 Step 1/4 — Building frontend (Vite)...")
  await spawn(["bun", "run", "build"], FRONTEND)

  // Step 2: Copy frontend dist → apps/backend/webui/
  console.log("\n📂 Step 2/4 — Copying frontend build to backend/webui/...")
  const backendWebui = path.join(BACKEND, "webui")
  await rm(backendWebui, { recursive: true, force: true })
  await cp(path.join(FRONTEND, "dist"), backendWebui, { recursive: true })
  console.log(`   ✅ Copied to ${path.relative(ROOT, backendWebui)}`)

  // Step 3: Compile backend binary
  console.log("\n⚙️  Step 3/4 — Compiling binary (bun build --compile)...")
  // Remove only build artifacts, preserve data/ (database files)
  await rm(path.join(DIST, "hookitup"), { force: true })
  await rm(path.join(DIST, "drizzle"), { recursive: true, force: true })
  await rm(path.join(DIST, "public"), { recursive: true, force: true })
  await rm(path.join(DIST, "webui"), { recursive: true, force: true })
  await mkdir(DIST, { recursive: true })
  await spawn(
    [
      "bun",
      "build",
      "--compile",
      "--target=bun",
      "--outfile",
      path.join(DIST, "hookitup"),
      "src/main.ts",
    ],
    BACKEND,
  )

  // Step 4: Copy runtime assets alongside binary
  console.log("\n📋 Step 4/4 — Copying runtime assets to dist/...")
  await cp(path.join(BACKEND, "drizzle"), path.join(DIST, "drizzle"), {
    recursive: true,
  })
  await cp(path.join(BACKEND, "public"), path.join(DIST, "public"), {
    recursive: true,
  })
  await cp(backendWebui, path.join(DIST, "webui"), {
    recursive: true,
  })
  console.log("   ✅ drizzle/, public/ and webui/ copied")

  console.log(`
✅ Build complete! Output: dist/

  dist/
  ├── hookitup   — compiled binary (includes Bun runtime + all app code)
  ├── drizzle/   — SQL migrations (applied automatically on first run)
  ├── public/    — static files (favicon, etc.)
  ├── webui/     — frontend SPA static files
  └── data/      — database files (created automatically on first run)

To run:
  cd dist/
  ./hookitup
`)
}

main().catch((err: unknown) => {
  console.error("Build failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})

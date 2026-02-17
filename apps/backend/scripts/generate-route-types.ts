/**
 * Script to generate TypeScript types for all registered routes.
 * This enables type-safe internal redirects using res.redirectTo()
 */

// Import all routes to register them
import "../src/routes"

import { exportRouteTypes, routeRegistry } from "@bunkit/server"

const outputPath = "./src/generated/routes.d.ts"

console.log("🔄 Generating route types...")

const result = await exportRouteTypes(routeRegistry, {
  outputPath,
})

if (result.isOk()) {
  console.log(`✅ Route types generated successfully: ${outputPath}`)
} else {
  console.error("❌ Failed to generate route types:", result.error)
  process.exit(1)
}

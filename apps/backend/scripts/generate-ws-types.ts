#!/usr/bin/env bun

import path from "node:path"
import { parseArgs } from "node:util"
import { server } from "@/core/server"
import { loadRoutes } from "@/routes"

/**
 * Parse command line arguments
 */
function parseArguments() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      output: {
        type: "string",
        short: "o",
        default: "websocket-types.ts",
      },
      routes: {
        type: "string",
        short: "r",
        multiple: true,
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
    },
    strict: true,
    allowPositionals: false,
  })

  return values
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
WebSocket Types Generator

Usage:
  bun run scripts/generate-ws-types.ts [options]

Options:
  -o, --output <file>    Output file path (default: websocket-types.ts)
  -r, --routes <path>    Filter specific routes (can be used multiple times)
  -h, --help             Show this help message

Examples:
  bun run scripts/generate-ws-types.ts
  bun run scripts/generate-ws-types.ts --output ws-types.ts
  bun run scripts/generate-ws-types.ts --routes /ws/chat
  bun run scripts/generate-ws-types.ts --output frontend/types.ts --routes /ws/chat
  `)
}

/**
 * Main function
 */
async function main() {
  const args = parseArguments()

  if (args.help) {
    showHelp()
    process.exit(0)
  }

  try {
    console.info("🚀 Starting WebSocket types generation...")

    // Load routes
    await loadRoutes()

    // Generate WebSocket types
    let outputPath = args.output as string

    // Add default filename if a directory is provided
    if (!/\.[^/\\]+$/.test(outputPath)) {
      outputPath = path.join(outputPath, "websocket-types.ts")
    }

    // Make the output path relative to the current working directory
    outputPath = path.resolve(process.cwd(), outputPath)

    const routeFilter = args.routes as string[] | undefined

    const result = await server.ws.getWebSocketTypes({
      outputPath,
      routes: routeFilter,
    })

    if (result.isErr()) {
      throw result.error
    }

    console.info("✅ WebSocket types generated successfully", {
      path: outputPath,
      routes: routeFilter?.length ?? "all",
      generatedAt: new Date().toISOString(),
    })

    console.info("✅ Generation complete!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Failed to generate WebSocket types", { error })
    process.exit(1)
  }
}

main()

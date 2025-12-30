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
        default: "openapi.json",
      },
      types: {
        type: "boolean",
        short: "t",
        default: false,
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
OpenAPI Specification Generator

Usage:
  bun run scripts/generate-openapi.ts [options]

Options:
  -o, --output <file>    Output file path (default: openapi.json)
  -t, --types            Generate TypeScript types from spec
  -h, --help             Show this help message

Examples:
  bun run scripts/generate-openapi.ts
  bun run scripts/generate-openapi.ts --output api-spec.json
  bun run scripts/generate-openapi.ts --types
  bun run scripts/generate-openapi.ts --output spec.json --types
  `)
}

/**
 * Generate TypeScript types from OpenAPI spec
 */
async function generateTypes(specPath: string): Promise<void> {
  try {
    console.info("Generating TypeScript types from OpenAPI spec...")

    // Use openapi-typescript via npx/bunx
    const proc = Bun.spawn([
      "bunx",
      "openapi-typescript",
      specPath,
      "--output",
      specPath.replace(".json", ".d.ts"),
    ])

    const exitCode = await proc.exited

    if (exitCode !== 0) {
      throw new Error(`openapi-typescript exited with code ${exitCode}`)
    }

    console.info("✅ TypeScript types generated successfully", {
      output: specPath.replace(".json", ".d.ts"),
    })
  } catch (error) {
    console.error("Failed to generate TypeScript types", { error })
    throw error
  }
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
    console.info("🚀 Starting OpenAPI specification generation...")

    // Load routes
    await loadRoutes()

    // Initialize server
    const startResult = await server.start()
    if (startResult.isErr()) {
      throw startResult.error
    }

    // Generate OpenAPI spec
    const specResult = await server.getOpenApiSpec()

    if (specResult.isErr()) {
      throw specResult.error
    }

    const spec = specResult.value
    console.info("✅ OpenAPI specification generated", {
      paths: Object.keys(spec.paths || {}).length,
      version: spec.info.version,
      generatedAt: new Date().toISOString(),
    })

    // Write to file
    let outputPath = args.output as string

    // Add default filename if a directory is provided
    if (!/\.[^/\\]+$/.test(outputPath)) {
      outputPath = path.join(outputPath, "openapi.json")
    }

    // Make the output path relative to the current working directory
    outputPath = path.resolve(process.cwd(), outputPath)

    await Bun.write(outputPath, JSON.stringify(spec, null, 2))
    console.info("✅ OpenAPI specification written to file", {
      path: outputPath,
    })

    // Generate TypeScript types if requested
    if (args.types) {
      await generateTypes(outputPath)
    }

    // Cleanup
    await server.stop()

    console.info("✅ Generation complete!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Failed to generate OpenAPI specification", { error })
    process.exit(1)
  }
}

main()

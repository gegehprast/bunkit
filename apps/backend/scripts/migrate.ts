#!/usr/bin/env bun

/**
 * Database Migration Script
 *
 * This script will scan all .env files in the backend directory,
 * extract DATABASE_URLs, and run migrations against each unique database.
 */

import { readdir } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"

/**
 * Parse command line arguments
 */
function parseArguments() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      test: {
        type: "boolean",
        short: "t",
        default: false,
      },
      local: {
        type: "boolean",
        short: "l",
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
Database Migration Script

Usage:
  bun run scripts/migrate.ts [options]

Options:
  -t, --test            Migrate only test database (from .env.test)
  -l, --local           Migrate only local database (from .env.local)
  -h, --help            Show this help message

Examples:
  bun run scripts/migrate.ts              # Migrate ALL unique databases from all .env files
  bun run scripts/migrate.ts --test       # Migrate ONLY test database
  bun run scripts/migrate.ts --local      # Migrate ONLY local database
  `)
}

/**
 * Load environment variables from a specific .env file
 */
async function loadEnvFile(
  filePath: string,
): Promise<Record<string, string> | null> {
  try {
    const file = Bun.file(filePath)
    const content = await file.text()
    const env: Record<string, string> = {}

    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...values] = trimmed.split("=")
        if (key && values.length > 0) {
          env[key.trim()] = values.join("=").trim()
        }
      }
    }

    return env
  } catch (_error) {
    return null
  }
}

/**
 * Scan all .env files and collect unique DATABASE_URLs
 */
async function scanEnvFiles(
  backendDir: string,
): Promise<Map<string, { url: string; source: string }>> {
  const databaseUrls = new Map<string, { url: string; source: string }>()

  // Find all .env files (excluding .env.example as it's just a template)
  const files = await readdir(backendDir)
  const envFiles = files.filter(
    (file) =>
      (file === ".env" || file.startsWith(".env.")) && file !== ".env.example",
  )

  for (const envFile of envFiles) {
    const envPath = path.join(backendDir, envFile)
    const env = await loadEnvFile(envPath)

    if (env?.DATABASE_URL) {
      const url = env.DATABASE_URL
      if (!databaseUrls.has(url)) {
        databaseUrls.set(url, { url, source: envFile })
      }
    }
  }

  return databaseUrls
}

/**
 * Run migration against a specific DATABASE_URL
 */
async function runMigration(
  databaseUrl: string,
  source: string,
  backendDir: string,
): Promise<boolean> {
  console.info(`\n📊 Migrating: ${source}`)
  // Mask password in logs
  console.info(`   Database: ${databaseUrl.replace(/:[^:@]+@/, ":***@")}`)

  const spawn = Bun.spawn({
    cmd: ["bunx", "drizzle-kit", "migrate"],
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdout: "inherit",
    stderr: "inherit",
  })

  const exitCode = await spawn.exited

  if (exitCode !== 0) {
    console.error(`   ❌ Migration failed for ${source}`)
    return false
  }

  console.info(`   ✅ Migration complete for ${source}`)
  return true
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
    const backendDir = path.resolve(__dirname, "..")

    // Determine if a specific environment was requested
    const specificEnv = args.test
      ? ".env.test"
      : args.local
        ? ".env.local"
        : null

    if (specificEnv) {
      // Migrate only the specific environment
      console.info(`🔄 Starting database migration for ${specificEnv}...`)

      const envPath = path.join(backendDir, specificEnv)
      const env = await loadEnvFile(envPath)

      if (!env || !env.DATABASE_URL) {
        console.error(`❌ DATABASE_URL not found in ${specificEnv}`)
        process.exit(1)
      }

      const success = await runMigration(
        env.DATABASE_URL,
        specificEnv,
        backendDir,
      )

      if (!success) {
        process.exit(1)
      }

      console.info(`\n✨ Migration complete!`)
      process.exit(0)
    }

    // Scan all .env files and migrate all unique databases
    console.info("🔍 Scanning for .env files...")

    const databaseUrls = await scanEnvFiles(backendDir)

    if (databaseUrls.size === 0) {
      console.error("❌ No DATABASE_URL found in any .env files")
      process.exit(1)
    }

    console.info(`📋 Found ${databaseUrls.size} unique database(s) to migrate`)

    // Run migrations for all unique databases
    let successCount = 0
    let failCount = 0

    for (const [url, { source }] of databaseUrls) {
      const success = await runMigration(url, source, backendDir)
      if (success) {
        successCount++
      } else {
        failCount++
      }
    }

    console.info(`\n✨ Migration summary:`)
    console.info(`   ✅ Successful: ${successCount}`)
    if (failCount > 0) {
      console.info(`   ❌ Failed: ${failCount}`)
      process.exit(1)
    }

    process.exit(0)
  } catch (error) {
    console.error("❌ Failed to perform migration", { error })
    process.exit(1)
  }
}

main()

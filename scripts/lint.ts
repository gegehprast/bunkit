#!/usr/bin/env bun

/**
 * Lint script - runs biome lint and all typecheck commands
 */

/**
 * Commands to run
 */
const commands = [
  { name: "Biome Lint", cmd: "bunx --bun biome lint --write" },
  { name: "Typecheck Root & Packages", cmd: "bun run typecheck" },
  { name: "Typecheck Backend", cmd: "bun run typecheck:backend" },
  { name: "Typecheck Frontend", cmd: "bun run typecheck:frontend" },
]

async function runLint() {
  let hasError = false

  for (const { name, cmd } of commands) {
    console.log(`\n🔍 Running: ${name}...`)

    const proc = Bun.spawn(cmd.split(" "), {
      stdout: "inherit",
      stderr: "inherit",
    })

    const exitCode = await proc.exited

    if (exitCode !== 0) {
      console.error(`❌ ${name} failed with exit code ${exitCode}`)
      hasError = true
      // Continue to next command instead of breaking
    } else {
      console.log(`✅ ${name} passed`)
    }
  }

  if (hasError) {
    console.log("\n⚠️  Some lint checks failed!")
    process.exit(1)
  }

  console.log("\n✨ All lint checks passed!")
}

runLint()

export {} // Trick TypeScript into treating this as a module

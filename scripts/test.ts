#!/usr/bin/env bun

/**
 * Test script - runs all tests for each packages
 */

import { parseArgs } from "node:util"

/**
 * Commands to run
 */
const commands = [
  { name: "Backend Test", cmd: "bun --env-file=./apps/backend/.env.test test" },
]

function parseArguments() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
      coverage: {
        type: "boolean",
        short: "c",
        default: false,
      },
      "test-name-pattern": {
        type: "string",
        short: "t",
      },
    },
    strict: true,
    allowPositionals: false,
  })

  return values
}

function showHelp() {
  console.log(`
Run all tests for each package

Usage:
  bun run scripts/test.ts [options]

Options:
  -h, --help       Show this help message
  -c, --coverage   Generate coverage report
  -t, --test-name-pattern <pattern>   Run only tests with names matching the pattern
`)
}

function parseCommand(cmd: string): string[] {
  const args: string[] = []
  const regex = /"([^"]*)"|(\S+)/g
  let match: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: Needed for regex exec loop
  while ((match = regex.exec(cmd)) !== null) {
    args.push(match[1] ?? match[2])
  }
  return args
}

async function runTests() {
  const args = parseArguments()

  if (args.help) {
    showHelp()
    process.exit(0)
  }

  if (args["test-name-pattern"]) {
    // Modify commands to include test name pattern
    for (const command of commands) {
      command.cmd += ` -t "${args["test-name-pattern"]}"`
    }
  }

  if (args.coverage) {
    // Modify commands to include coverage flag
    for (const command of commands) {
      command.cmd += " --coverage"
    }
  }

  let hasError = false

  for (const { name, cmd } of commands) {
    console.log(`\n🧪 Running: ${name}...`)

    const proc = Bun.spawn(parseCommand(cmd), {
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
    console.log("\n⚠️  Some tests failed!")
    process.exit(1)
  }

  console.log("\n✨ All tests passed!")
}

runTests()

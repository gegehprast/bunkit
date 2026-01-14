#!/usr/bin/env bun

/**
 * Test script - runs all tests for each packages
 */

import { parseArgs } from "node:util"

/**
 * Commands to run
 */
const commands = [
  {
    name: "apps/backend",
    cmd: "bun --env-file=./apps/backend/.env.test test apps/backend",
  },
  {
    name: "packages/result",
    cmd: "bun test packages/result",
  },
  {
    name: "packages/server",
    cmd: "bun test packages/server",
  },
]

function parseOptions() {
  const { values } = parseArgs({
    args: Bun.argv,
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
      bail: {
        type: "boolean",
        short: "b",
        default: false,
      },
    },
    strict: true,
    allowPositionals: true,
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
    // biome-ignore lint/style/noNonNullAssertion: Regex ensures one of the groups will match
    const arg = match[1] ?? match[2]!
    args.push(arg)
  }
  return args
}

async function runTests() {
  const options = parseOptions()

  if (options.help) {
    showHelp()
    process.exit(0)
  }

  if (options["test-name-pattern"]) {
    // Modify commands to include test name pattern
    for (const command of commands) {
      command.cmd += ` -t "${options["test-name-pattern"]}"`
    }
  }

  if (options.bail) {
    // Modify commands to include bail flag
    for (const command of commands) {
      command.cmd += ` --bail`
    }
  }

  if (options.coverage) {
    // Modify commands to include coverage flag
    for (const command of commands) {
      command.cmd += " --coverage"
    }
  }

  const results: Array<{
    name: string
    passed: boolean
    totalTests?: number
  }> = []

  for (const { name, cmd } of commands) {
    console.log(`\n🧪 Running: ${name}...`)

    const proc = Bun.spawn(parseCommand(cmd), {
      stdout: "inherit",
      stderr: "inherit",
    })

    const exitCode = await proc.exited

    if (exitCode !== 0) {
      console.error(`❌ ${name} failed with exit code ${exitCode}`)
      results.push({
        name,
        passed: false,
      })
    } else {
      console.log(`✅ ${name} passed`)
      results.push({
        name,
        passed: true,
      })
    }
  }

  // Display summary
  console.log(`\n${"=".repeat(60)}`)
  console.log("📊 Test Results Summary")
  console.log("=".repeat(60))

  for (const { name, passed } of results) {
    const status = passed ? "PASSED" : "FAILED"
    const icon = passed ? "✅" : "❌"

    console.log(`${icon} ${name}: ${status}`)
  }

  console.log("=".repeat(60))

  const failedCount = results.filter((r) => !r.passed).length

  if (failedCount > 0) {
    console.log("\n⚠️  Some tests failed!")
    process.exit(1)
  }

  console.log("\n✨ All tests passed!")
}

runTests()

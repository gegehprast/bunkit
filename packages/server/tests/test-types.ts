/**
 * Type declarations for test files
 * Extends the Context interface with test-specific properties
 */

declare module "../src/index" {
  interface Context {
    // Test properties
    userId?: string
    role?: string
    authenticated?: boolean
    user?: { id: string; name?: string }
    timestamp?: number
  }
}

export {}

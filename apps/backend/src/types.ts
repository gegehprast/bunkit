/**
 * Type declarations and extensions for the BunKit backend application
 */

declare module "@bunkit/server" {
  /**
   * Extend the Context interface to add authentication properties
   * These properties are set by the authMiddleware
   */
  interface Context {
    /** User ID extracted from the JWT token */
    userId?: string
    /** User email extracted from the JWT token */
    userEmail?: string
  }
}

export {}

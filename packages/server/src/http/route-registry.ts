import type { HttpMethod, MatchedRoute, RouteDefinition } from "./types/route"

/**
 * Route registry - stores registered routes and provides matching logic
 * Can be used as a global singleton or as a per-server instance
 */
export class RouteRegistry {
  private routes: RouteDefinition[] = []

  /**
   * Register a new route
   */
  public register(route: RouteDefinition): void {
    this.routes.push(route)
  }

  /**
   * Find a matching route for the given method and path
   */
  public match(method: HttpMethod, path: string): MatchedRoute | null {
    for (const route of this.routes) {
      if (route.method !== method) {
        continue
      }

      const params = this.matchPath(route.path, path)
      if (params !== null) {
        return { definition: route, params }
      }
    }

    return null
  }

  /**
   * Match a route path pattern against an actual path
   * Returns extracted parameters or null if no match
   *
   * Supports:
   * - Static segments: /api/users
   * - Path parameters: /api/users/:id
   * - Wildcard parameters: /public/:path* (captures remaining segments)
   */
  private matchPath(
    pattern: string,
    path: string,
  ): Record<string, string> | null {
    const patternParts = pattern.split("/").filter(Boolean)
    const pathParts = path.split("/").filter(Boolean)

    const params: Record<string, string> = {}

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i]
      const pathPart = pathParts[i]

      if (!patternPart) {
        return null
      }

      // Check for wildcard parameter (e.g., :path*)
      if (patternPart.startsWith(":") && patternPart.endsWith("*")) {
        // Extract wildcard parameter name (remove : prefix and * suffix)
        const paramName = patternPart.slice(1, -1)

        // Capture all remaining path segments
        const remainingParts = pathParts.slice(i)

        // Wildcard must match at least one segment
        if (remainingParts.length === 0) {
          return null
        }

        params[paramName] = remainingParts.join("/")

        // Wildcard consumes all remaining segments, so we're done
        return params
      }

      // For non-wildcard patterns, path part must exist
      if (!pathPart) {
        return null
      }

      if (patternPart.startsWith(":")) {
        // Extract regular parameter
        const paramName = patternPart.slice(1)
        params[paramName] = pathPart
      } else if (patternPart !== pathPart) {
        // Static segment doesn't match
        return null
      }
    }

    // Ensure all path parts were consumed (no extra segments)
    if (patternParts.length !== pathParts.length) {
      return null
    }

    return params
  }

  /**
   * Get all registered routes
   */
  public getAll(): RouteDefinition[] {
    return [...this.routes]
  }

  /**
   * Clear all routes (useful for testing)
   */
  public clear(): void {
    this.routes = []
  }
}

// Global singleton instance
export const routeRegistry = new RouteRegistry()

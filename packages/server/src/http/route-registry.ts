import type { HttpMethod, MatchedRoute, RouteDefinition } from "../types/route"

/**
 * Global route registry
 * Stores all registered routes and provides matching logic
 */
class RouteRegistry {
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
   */
  private matchPath(
    pattern: string,
    path: string,
  ): Record<string, string> | null {
    const patternParts = pattern.split("/").filter(Boolean)
    const pathParts = path.split("/").filter(Boolean)

    if (patternParts.length !== pathParts.length) {
      return null
    }

    const params: Record<string, string> = {}

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i]
      const pathPart = pathParts[i]

      if (!patternPart || !pathPart) {
        return null
      }

      if (patternPart.startsWith(":")) {
        // Extract parameter
        const paramName = patternPart.slice(1)
        params[paramName] = pathPart
      } else if (patternPart !== pathPart) {
        // Static segment doesn't match
        return null
      }
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

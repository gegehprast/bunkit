import type {
  MatchedWebSocketRoute,
  WebSocketRouteDefinition,
} from "./types/websocket"

/**
 * WebSocket route registry - stores registered routes and provides matching logic
 * Can be used as a global singleton or as a per-server instance
 */
export class WebSocketRouteRegistry {
  private routes: WebSocketRouteDefinition<unknown, unknown>[] = []

  /**
   * Register a new WebSocket route
   */
  public register(route: WebSocketRouteDefinition<unknown, unknown>): void {
    this.routes.push(route)
  }

  /**
   * Find a matching WebSocket route for the given path
   */
  public match(path: string): MatchedWebSocketRoute | null {
    for (const route of this.routes) {
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
   * Get all registered WebSocket routes
   */
  public getAll(): WebSocketRouteDefinition<unknown, unknown>[] {
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
export const webSocketRouteRegistry = new WebSocketRouteRegistry()

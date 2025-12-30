import type { z } from "zod"
import type { MiddlewareFn } from "./middleware"
import type { RouteContext } from "./context"

/**
 * Extract path parameters from a route path string
 * Example: "/users/:userId/posts/:postId" -> { userId: string, postId: string }
 */
export type ExtractParams<T extends string> =
	T extends `${infer _Start}:${infer Param}/${infer Rest}`
		? { [K in Param | keyof ExtractParams<`/${Rest}`>]: string }
		: T extends `${infer _Start}:${infer Param}`
			? { [K in Param]: string }
			: Record<string, never>

/**
 * HTTP methods supported by the server
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"

/**
 * Route metadata for OpenAPI generation
 */
export interface RouteMetadata {
	operationId?: string
	summary?: string
	description?: string
	tags?: string[]
	deprecated?: boolean
}

/**
 * Response configuration for a route
 */
export interface ResponseConfig {
	description?: string
	content?: Record<string, { schema?: z.ZodTypeAny }>
}

/**
 * Internal route definition stored in the registry
 */
export interface RouteDefinition {
	method: HttpMethod
	path: string
	metadata?: RouteMetadata
	querySchema?: z.ZodTypeAny
	bodySchema?: z.ZodTypeAny
	responseSchema?: z.ZodTypeAny
	responses?: Record<number, ResponseConfig>
	errorResponses?: Record<number, ResponseConfig>
	middlewares?: MiddlewareFn[]
	handler: (context: RouteContext<Record<string, string>, unknown, unknown>) => Promise<Response> | Response
}

/**
 * Matched route with extracted parameters
 */
export interface MatchedRoute {
	definition: RouteDefinition
	params: Record<string, string>
}

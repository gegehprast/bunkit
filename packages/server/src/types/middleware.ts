import type { ResponseHelpers } from "./response"

/**
 * Arguments passed to middleware functions
 */
export interface MiddlewareArgs {
	req: Request
	params: Record<string, string>
	query: unknown
	body: unknown
	ctx: Record<string, unknown>
	res: ResponseHelpers
	next: () => Promise<Response | undefined>
}

/**
 * Middleware function type
 */
export type MiddlewareFn = (
	context: MiddlewareArgs,
) => Promise<Response | undefined> | Response | undefined

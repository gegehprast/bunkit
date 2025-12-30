import type { MiddlewareFn, MiddlewareArgs } from "./types/middleware"
import type { ResponseHelpers } from "./types/response"

/**
 * Execute middleware chain
 * Returns Response if chain is short-circuited, undefined if handler should run
 */
export async function executeMiddlewareChain(
	middlewares: MiddlewareFn[],
	args: MiddlewareArgs,
): Promise<Response | undefined> {
	let index = 0

	async function next(): Promise<Response | undefined> {
		if (index >= middlewares.length) {
			return undefined
		}

		const middleware = middlewares[index]
		if (!middleware) {
			return undefined
		}

		index++

		const result = await middleware({
			...args,
			next,
		})

		return result
	}

	return next()
}

/**
 * Create middleware execution arguments
 */
export function createMiddlewareArgs(
	req: Request,
	params: Record<string, string>,
	query: unknown,
	body: unknown,
	ctx: Record<string, unknown>,
	res: ResponseHelpers,
): MiddlewareArgs {
	return {
		req,
		params,
		query,
		body,
		ctx,
		res,
		next: async () => undefined, // Will be replaced by executeMiddlewareChain
	}
}

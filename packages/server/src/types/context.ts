import type { ResponseHelpers } from "./response"

/**
 * Context passed to route handlers
 */
export interface RouteContext<
	TParams = Record<string, string>,
	TQuery = unknown,
	TBody = unknown,
> {
	req: Request
	res: ResponseHelpers
	params: TParams
	query: TQuery
	body: TBody
	ctx: Record<string, unknown>
}

/**
 * Handler function type
 */
export type RouteHandler<
	TQuery = unknown,
	TBody = unknown,
	TParams = Record<string, string>,
> = (
	context: RouteContext<TParams, TQuery, TBody>,
) => Promise<Response> | Response

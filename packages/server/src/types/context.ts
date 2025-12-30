import type { ResponseHelpers } from "./response"

/**
 * Context passed to route handlers
 */
export interface RouteContext<
  TParams = Record<string, string>,
  TQuery = unknown,
  TBody = unknown,
  TResponse = unknown,
> {
  req: Request
  res: ResponseHelpers<TResponse>
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
  TResponse = unknown,
> = (
  context: RouteContext<TParams, TQuery, TBody, TResponse>,
) => Promise<Response> | Response

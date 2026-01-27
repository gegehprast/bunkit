import type { ResponseHelpers } from "./response"

/**
 * Props passed to route handlers
 */
export interface RouteHandlerProps<
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
  props: RouteHandlerProps<TParams, TQuery, TBody, TResponse>,
) => Promise<Response> | Response

import type { Server as BunServer } from "bun"
import type { ResponseBuilder } from "./response"

/**
 * Base context interface that can be extended via declaration merging.
 * Note: all properties must be optional!
 *
 * @example
 * // In your app, extend the Context interface:
 * declare module "@bunkit/server" {
 *   interface Context {
 *     userId?: string
 *     userEmail?: string
 *   }
 * }
 *
 * // Now your handlers will have type-safe access to ctx.userId
 */
// biome-ignore lint/suspicious/noEmptyInterface: Empty interface is intentional for declaration merging
export interface Context {}

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
  res: ResponseBuilder<TResponse>
  params: TParams
  query: TQuery
  body: TBody
  ctx: Context
  bunServer: BunServer<unknown>
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

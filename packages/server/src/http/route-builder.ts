import type { MakeRequired } from "node_modules/zod/v4/core/util"
import type { z } from "zod"
import { CommonErrorResponses } from "../core/standard-errors"
import type { MiddlewareFn } from "../types/middleware"
import type { Server } from "../types/server"
import { RouteRegistry, routeRegistry } from "./route-registry"
import type { RouteHandler } from "./types/context"
import type {
  ErrorResponseConfig,
  ExtractParams,
  HttpMethod,
  ResponseConfig,
  RouteDefinition,
  RouteMetadata,
} from "./types/route"

/**
 * Route builder with fluent API and type-safe generics.
 * Automatically extracts path parameters and enforces handler type safety.
 */
export class RouteBuilder<
  TPath extends string,
  TQuery = unknown,
  TBody = unknown,
  TParams = ExtractParams<TPath>,
  TResponse = unknown,
> {
  private _metadata?: RouteMetadata
  private _querySchema?: z.ZodType
  private _bodySchema?: z.ZodType
  private _response?: MakeRequired<ResponseConfig, "content">
  private _errorResponses?: ErrorResponseConfig
  private _middlewares: MiddlewareFn[] = []
  private _security?: Array<Record<string, string[]>>
  private _excludeFromDocs = false

  public constructor(
    private readonly method: HttpMethod,
    private readonly path: TPath,
    private readonly server?: Server,
  ) {}

  /**
   * Add OpenAPI metadata.
   */
  public openapi(
    metadata: RouteMetadata,
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._metadata = metadata
    return this
  }

  /**
   * Add route-level middlewares.
   */
  public middlewares(
    ...fns: MiddlewareFn[]
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._middlewares.push(...fns)
    return this
  }

  /**
   * Add security requirements for this route.
   *
   * Bunkit will automatically add a 401 Unauthorized error response to the generated OpenAPI spec,
   * but you can still override it on the `.errorResponses()` chain.
   *
   * @example .security([{ bearerAuth: [] }])
   * @default [{ bearerAuth: [] }]
   */
  public security(
    requirements?: Array<Record<string, string[]>>,
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    if (!requirements) {
      requirements = [{ bearerAuth: [] }]
    }

    this._security = requirements
    return this
  }

  /**
   * Exclude this route from OpenAPI documentation.
   *
   * @example
   * ```typescript
   * createRoute("GET", "/internal/debug")
   *   .excludeFromDocs()
   *   .handler(({ res }) => res.ok({ debug: true }))
   * ```
   */
  public excludeFromDocs(
    exclude = true,
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._excludeFromDocs = exclude
    return this
  }

  /**
   * Define query parameter schema. Use this for routes that accept query parameters.
   *
   * Bunkit will automatically add a 400 Bad Request error response to the generated OpenAPI spec,
   * but you can still override it on the `.errorResponses()` chain.
   *
   * @example
   * .query(z.object({ search: z.string().optional(), page: z.number().default(1) }))
   */
  public query<T extends z.ZodType>(
    schema: T,
  ): RouteBuilder<TPath, z.infer<T>, TBody, TParams, TResponse> {
    this._querySchema = schema
    return this as unknown as RouteBuilder<
      TPath,
      z.infer<T>,
      TBody,
      TParams,
      TResponse
    >
  }

  /**
   * Define request body schema. Use this for routes that accept JSON request bodies.
   *
   * Bunkit will automatically add a 400 Bad Request error response to the generated OpenAPI spec,
   * but you can still override it on the `.errorResponses()` chain.
   *
   * @example
   * .body(z.object({ title: z.string(), description: z.string().optional() }))
   */
  public body<T extends z.ZodType>(
    schema: T,
  ): RouteBuilder<TPath, TQuery, z.infer<T>, TParams, TResponse> {
    this._bodySchema = schema
    return this as unknown as RouteBuilder<
      TPath,
      TQuery,
      z.infer<T>,
      TParams,
      TResponse
    >
  }

  /**
   * Define response schema.
   * Optionally provide description and status code (default 200).
   *
   * @example
   * .response(SuccessResponseSchema, { description: "Successful response", status: 200 })
   */
  public response<T extends z.ZodType>(
    schema: T,
    options?: { description?: string; status?: number },
  ): RouteBuilder<TPath, TQuery, TBody, TParams, z.infer<T>> {
    this._response = {
      status: options?.status ?? 200,
      description: options?.description,
      content: {
        "application/json": { schema },
      },
    }

    return this as unknown as RouteBuilder<
      TPath,
      TQuery,
      TBody,
      TParams,
      z.infer<T>
    >
  }

  /**
   * Add standard error responses by status code.
   * Uses predefined error response schemas from `CommonErrorResponses`.
   * Bunkit will automatically add some common error responses (400, 401, 500)
   * depending on the route configuration, so you probably don't need to add them manually.
   * @example .errors([400, 401, 422])
   */
  public errors(
    statusCodes: number[],
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    if (!this._errorResponses) {
      this._errorResponses = {}
    }

    for (const status of statusCodes) {
      // Use common error response if available, otherwise create a basic one
      const commonError =
        CommonErrorResponses[status as keyof typeof CommonErrorResponses]
      if (commonError) {
        this._errorResponses[status] = commonError
      } else {
        this._errorResponses[status] = this.getCommonErrorResponse(status)
      }
    }

    return this
  }

  /**
   * Define custom error response schemas.
   * Use this to define or override error responses for specific status codes.
   *
   * @example
   * .errorResponses({
   *   422: {
   *     description: "Unprocessable Entity",
   *     content: {
   *       "application/json": {
   *         schema: CustomUnprocessableEntitySchema,
   *       },
   *     },
   *   },
   * })
   */
  public errorResponses(
    responses: ErrorResponseConfig,
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._errorResponses = { ...this._errorResponses, ...responses }
    return this
  }

  /**
   * Define the route handler. This is the final step in the route builder chain.
   * The handler function receives typed props inferred from the route definition (ctx, path params, query, body, response).
   *
   * @example
   * .handler(async ({ ctx, req, res, query, params, body }) => {
   *   const items = await getItems(query)
   *   return res.ok(items)
   * })
   */
  public handler(fn: RouteHandler<TQuery, TBody, TParams, TResponse>): void {
    const definition: RouteDefinition = {
      method: this.method,
      path: this.path,
      metadata: this._metadata,
      querySchema: this._querySchema,
      bodySchema: this._bodySchema,
      response: this._response,
      errorResponses: this._errorResponses,
      middlewares: this._middlewares,
      security: this._security,
      excludeFromDocs: this._excludeFromDocs,
      handler: fn as unknown as RouteDefinition["handler"],
    }

    // If server is provided, register to local registry
    // Otherwise, register to global registry
    if (this.server) {
      if (!this.server._routeRegistry) {
        this.server._routeRegistry = new RouteRegistry()
      }
      this.server._routeRegistry.register(definition)
    } else {
      routeRegistry.register(definition)
    }
  }

  private getCommonErrorResponse(status: number) {
    return (
      CommonErrorResponses[status as keyof typeof CommonErrorResponses] || {}
    )
  }
}

/**
 * Create a new route builder
 *
 * @param method HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param path Route path with optional parameters (e.g., "/users/:id")
 * @param server Optional server instance to register the route to.
 *
 * If `server` is provided, the route is registered to the server's local registry.
 * If not provided, the route is registered to the global registry.
 */
export function createRoute<TPath extends string>(
  method: HttpMethod,
  path: TPath,
  server?: Server,
): RouteBuilder<TPath, unknown, unknown, ExtractParams<TPath>, unknown> {
  return new RouteBuilder(method, path, server)
}

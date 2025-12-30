import type { z } from "zod"
import { routeRegistry } from "./route-registry"
import type { RouteHandler } from "./types/context"
import type { MiddlewareFn } from "./types/middleware"
import type {
  ExtractParams,
  HttpMethod,
  ResponseConfig,
  RouteDefinition,
  RouteMetadata,
} from "./types/route"

/**
 * Route builder with fluent API and type-safe generics
 * Automatically extracts path parameters and enforces handler type safety
 */
export class RouteBuilder<
  TPath extends string,
  TQuery = unknown,
  TBody = unknown,
  TParams = ExtractParams<TPath>,
  TResponse = unknown,
> {
  private _metadata?: RouteMetadata
  private _querySchema?: z.ZodTypeAny
  private _bodySchema?: z.ZodTypeAny
  private _responseSchema?: z.ZodTypeAny
  private _responses?: Record<number, ResponseConfig>
  private _errorResponses?: Record<number, ResponseConfig>
  private _middlewares: MiddlewareFn[] = []
  private _security?: Array<Record<string, string[]>>

  public constructor(
    private readonly method: HttpMethod,
    private readonly path: TPath,
  ) {}

  /**
   * Add OpenAPI metadata
   */
  public openapi(
    metadata: RouteMetadata,
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._metadata = metadata
    return this
  }

  /**
   * Add route-level middlewares
   */
  public middlewares(
    ...fns: MiddlewareFn[]
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._middlewares.push(...fns)
    return this
  }

  /**
   * Add security requirements for this route
   * Example: .security([{ bearerAuth: [] }])
   */
  public security(
    requirements: Array<Record<string, string[]>>,
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._security = requirements
    return this
  }

  /**
   * Define query parameter schema
   */
  public query<T extends z.ZodTypeAny>(
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
   * Define request body schema
   */
  public body<T extends z.ZodTypeAny>(
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
   * Define single response schema
   */
  public response<T extends z.ZodTypeAny>(
    schema: T,
    options?: { description?: string; status?: number },
  ): RouteBuilder<TPath, TQuery, TBody, TParams, z.infer<T>> {
    this._responseSchema = schema
    if (options?.description || options?.status) {
      this._responses = {
        [options?.status ?? 200]: {
          description: options?.description,
          content: {
            "application/json": { schema },
          },
        },
      }
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
   * Define multiple response schemas
   */
  public responses(
    responses: Record<number, ResponseConfig>,
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._responses = responses
    return this
  }

  /**
   * Add standard error responses by status code
   */
  public errors(
    statusCodes: number[],
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    if (!this._errorResponses) {
      this._errorResponses = {}
    }

    for (const status of statusCodes) {
      this._errorResponses[status] = {
        description: this.getErrorDescription(status),
        content: {
          "application/json": {
            schema: undefined, // Will use standard error schema
          },
        },
      }
    }

    return this
  }

  /**
   * Define custom error response schemas
   */
  public errorResponses(
    responses: Record<number, ResponseConfig>,
  ): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse> {
    this._errorResponses = { ...this._errorResponses, ...responses }
    return this
  }

  /**
   * Define the route handler (terminal operation)
   */
  public handler(fn: RouteHandler<TQuery, TBody, TParams, TResponse>): void {
    const definition: RouteDefinition = {
      method: this.method,
      path: this.path,
      metadata: this._metadata,
      querySchema: this._querySchema,
      bodySchema: this._bodySchema,
      responseSchema: this._responseSchema,
      responses: this._responses,
      errorResponses: this._errorResponses,
      middlewares: this._middlewares,
      security: this._security,
      handler: fn as unknown as RouteDefinition["handler"],
    }

    routeRegistry.register(definition)
  }

  /**
   * Get standard error description for status code
   */
  private getErrorDescription(status: number): string {
    const descriptions: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      409: "Conflict",
      422: "Unprocessable Entity",
      500: "Internal Server Error",
    }
    return descriptions[status] ?? "Error"
  }
}

/**
 * Create a new route builder
 */
export function createRoute<TPath extends string>(
  method: HttpMethod,
  path: TPath,
): RouteBuilder<TPath, unknown, unknown, ExtractParams<TPath>, unknown> {
  return new RouteBuilder(method, path)
}

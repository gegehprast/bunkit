import { ok, type Result } from "@bunkit/result"
import {
  createDocument,
  type ZodOpenApiObject,
  type ZodOpenApiSecuritySchemeObject,
} from "zod-openapi"
import {
  BadRequestErrorResponseSchema,
  CommonErrorResponses,
  ConflictErrorResponseSchema,
  ErrorResponseSchema,
  ForbiddenErrorResponseSchema,
  InternalServerErrorResponseSchema,
  NotFoundErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from "../../core/standard-errors"
import { type RouteRegistry, routeRegistry } from "../../http/route-registry.ts"
import type { RouteDefinition } from "../../http/types/route"
import type { OpenApiSpec } from "../../types/server"

export interface GenerateOpenApiSpecOptions {
  title: ZodOpenApiObject["info"]["title"]
  version: ZodOpenApiObject["info"]["version"]
  description: ZodOpenApiObject["info"]["description"]
  securitySchemes: Record<string, ZodOpenApiSecuritySchemeObject>
  servers: ZodOpenApiObject["servers"]
}

const OPENAPI_SPEC_VERSION = "3.1.0"

/**
 * Generate OpenAPI specification from registered routes
 * @param options - OpenAPI document options
 * @param localRegistry - Optional local route registry (uses global if not provided)
 */
export function generateOpenApiSpec(
  options: GenerateOpenApiSpecOptions,
  localRegistry?: RouteRegistry,
): Result<OpenApiSpec, Error> {
  // Use local registry if provided, otherwise fall back to global
  const registry = localRegistry ?? routeRegistry
  const routes = registry.getAll()
  const paths: Record<string, Record<string, unknown>> = {}

  // Group routes by path
  const pathMap = new Map<string, RouteDefinition[]>()
  for (const route of routes) {
    const existing = pathMap.get(route.path) ?? []
    existing.push(route)
    pathMap.set(route.path, existing)
  }

  // Build OpenAPI paths
  for (const [path, routeDefs] of pathMap) {
    const pathItem: Record<string, unknown> = {}

    for (const route of routeDefs) {
      const operation = buildOperation(route)
      pathItem[route.method.toLowerCase()] = operation
    }

    // Convert Express-style :param to OpenAPI {param} format
    const openApiPath = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}")
    paths[openApiPath] = pathItem
  }

  // Create document using zod-openapi with standard error schema
  const document = createDocument({
    openapi: OPENAPI_SPEC_VERSION,
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    servers: options.servers,
    paths,
    components: {
      schemas: {
        ErrorResponse: ErrorResponseSchema,
        BadRequestErrorResponse: BadRequestErrorResponseSchema,
        UnauthorizedErrorResponse: UnauthorizedErrorResponseSchema,
        ForbiddenErrorResponse: ForbiddenErrorResponseSchema,
        NotFoundErrorResponse: NotFoundErrorResponseSchema,
        ConflictErrorResponse: ConflictErrorResponseSchema,
        InternalServerErrorResponse: InternalServerErrorResponseSchema,
      },
      ...(options.securitySchemes
        ? {
            securitySchemes: options.securitySchemes,
          }
        : {}),
    },
  })

  return ok(document as OpenApiSpec)
}

/**
 * Build OpenAPI operation for a route
 */
function buildOperation(route: RouteDefinition): Record<string, unknown> {
  const operation: Record<string, unknown> = {}

  // Add metadata
  if (route.metadata) {
    if (route.metadata.operationId) {
      operation.operationId = route.metadata.operationId
    }
    if (route.metadata.summary) {
      operation.summary = route.metadata.summary
    }
    if (route.metadata.description) {
      operation.description = route.metadata.description
    }
    if (route.metadata.tags) {
      operation.tags = route.metadata.tags
    }
    if (route.metadata.deprecated) {
      operation.deprecated = route.metadata.deprecated
    }
  }

  // Extract path parameters
  const pathParams = extractPathParams(route.path)
  const parameters: Array<Record<string, unknown>> = []

  // Add path parameters
  for (const param of pathParams) {
    parameters.push({
      in: "path",
      name: param,
      required: true,
      schema: { type: "string" },
    })
  }

  // Add query parameters if schema is defined
  if (route.querySchema) {
    // Query params will be converted to individual parameters
    operation.requestParams = {
      query: route.querySchema,
    }
  }

  if (parameters.length > 0) {
    operation.parameters = parameters
  }

  // Add request body if schema is defined
  if (route.bodySchema) {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: route.bodySchema,
        },
      },
    }
  }

  // Add responses
  const responses: Record<string, unknown> = {}

  // Add success response
  if (route.response) {
    const { status, description, content } = route.response
    responses[status.toString()] = {
      description: description ?? `${status} response`,
      content: content,
    }
  }

  // Add error responses
  if (route.errorResponses) {
    for (const [status, config] of Object.entries(route.errorResponses)) {
      responses[status] = {
        description: config.description ?? `${status} error`,
        content:
          config.content ??
          getCommonErrorResponse(parseInt(status, 10)).content,
      }
    }
  }

  // Add common error responses by default if not already defined
  // 400 - Bad Request (if route has validation)
  if (!responses["400"] && (route.querySchema || route.bodySchema)) {
    responses["400"] = CommonErrorResponses[400]
  }

  // 401 - Unauthorized (if route requires authentication)
  if (!responses["401"] && route.security && route.security.length > 0) {
    responses["401"] = CommonErrorResponses[401]
  }

  // 500 - Internal Server Error (always add to all routes)
  if (!responses["500"]) {
    responses["500"] = CommonErrorResponses[500]
  }

  // Ensure at least a default response exists
  if (Object.keys(responses).length === 0) {
    responses["200"] = {
      description: "Success",
    }
  }

  operation.responses = responses

  // Add security if route has security requirements
  if (route.security) {
    operation.security = route.security
  }

  return operation
}

function getCommonErrorResponse(status: number) {
  const check =
    CommonErrorResponses[status as unknown as keyof typeof CommonErrorResponses]

  if (!check) {
    return CommonErrorResponses[500]
  }

  return check
}

/**
 * Extract parameter names from a path
 * Example: "/users/:userId/posts/:postId" -> ["userId", "postId"]
 */
function extractPathParams(path: string): string[] {
  const params: string[] = []
  const parts = path.split("/")

  for (const part of parts) {
    if (part.startsWith(":")) {
      params.push(part.slice(1))
    }
  }

  return params
}

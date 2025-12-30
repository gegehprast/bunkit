import { z } from "zod"
import { createDocument } from "zod-openapi"
import { routeRegistry } from "../route-registry"
import type { RouteDefinition } from "../types/route"
import type { OpenApiSpec } from "../types/server"
import type { SecuritySchemeObject } from "./security-schemes"

/**
 * Standard error response schema
 */
const ErrorResponseSchema = z
  .object({
    message: z.string().meta({ description: "Error message" }),
    code: z.string().optional().meta({ description: "Error code" }),
    details: z
      .any()
      .optional()
      .meta({ description: "Additional error details" }),
  })
  .meta({ id: "ErrorResponse" })

/**
 * Generate OpenAPI specification from registered routes
 */
export function generateOpenApiSpec(
  info: {
    title: string
    version: string
    description?: string
    securitySchemes?: Record<string, SecuritySchemeObject>
  } = {
    title: "API",
    version: "1.0.0",
  },
): OpenApiSpec {
  const routes = routeRegistry.getAll()
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

    paths[path] = pathItem
  }

  // Create document using zod-openapi
  const document = createDocument({
    openapi: "3.1.0",
    info: {
      title: info.title,
      version: info.version,
      description: info.description,
    },
    paths,
    components: info.securitySchemes
      ? {
          securitySchemes: info.securitySchemes,
        }
      : undefined,
  })

  return document as OpenApiSpec
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

  // Add success responses
  if (route.responses) {
    for (const [status, config] of Object.entries(route.responses)) {
      responses[status] = {
        description: config.description ?? `${status} response`,
        content: config.content,
      }
    }
  } else if (route.responseSchema) {
    // Default success response
    responses["200"] = {
      description: "Success",
      content: {
        "application/json": {
          schema: route.responseSchema,
        },
      },
    }
  }

  // Add error responses
  if (route.errorResponses) {
    for (const [status, config] of Object.entries(route.errorResponses)) {
      responses[status] = {
        description: config.description ?? `${status} error`,
        content: config.content ?? {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      }
    }
  }

  // Ensure at least a default response exists
  if (Object.keys(responses).length === 0) {
    responses["200"] = {
      description: "Success",
      content: {
        "application/json": {
          schema: z.any(),
        },
      },
    }
  }

  operation.responses = responses

  // Add security if route has security requirements
  if (route.security) {
    operation.security = route.security
  }

  return operation
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

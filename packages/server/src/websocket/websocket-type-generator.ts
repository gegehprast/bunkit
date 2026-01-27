import { ok, type Result } from "@bunkit/result"
import type { z } from "zod"
import type { RegisteredMessageHandler } from "./types/websocket"
import {
  type WebSocketRouteRegistry,
  webSocketRouteRegistry,
} from "./websocket-registry"

/**
 * Options for generating WebSocket types
 */
export interface GenerateWebSocketTypesOptions {
  /** Only generate for specific routes (optional) */
  routes?: string[]
}

/**
 * Options for exporting WebSocket types
 */
export interface ExportWebSocketTypesOptions
  extends GenerateWebSocketTypesOptions {
  /** Output file path */
  outputPath: string
}

/**
 * Convert a route path to a TypeScript namespace name
 * e.g., "/api/chat" -> "ApiChatWebSocket", "/notifications" -> "NotificationsWebSocket"
 * Handles special characters like hyphens: "/api/room-small" -> "ApiRoomSmallWebSocket"
 */
function pathToNamespace(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith(":")) // Skip path parameters
    .map((segment) => {
      // Convert kebab-case or snake_case to PascalCase
      return segment
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")
    })
    .join("")
    .concat("WebSocket")
}

/**
 * Get the type name from a Zod schema
 * Handles both Zod v3 (typeName) and Zod v4+ (type) conventions
 */
function getZodTypeName(schema: z.ZodType): string {
  const def = schema.def as unknown as Record<string, unknown>
  // Zod v4+ uses "type", v3 uses "typeName"
  return (def.type as string) || (def.typeName as string) || "unknown"
}

/**
 * Convert a Zod schema to TypeScript type string.
 * FIXME: Doesn't cover all Zod types.
 */
function zodSchemaToTypeString(schema: z.ZodType, indent = 2): string {
  const typeDef = schema.def as unknown as Record<string, unknown>
  const typeName = getZodTypeName(schema)

  switch (typeName) {
    case "string":
    case "ZodString":
      return "string"
    case "number":
    case "ZodNumber":
      return "number"
    case "boolean":
    case "ZodBoolean":
      return "boolean"
    case "null":
    case "ZodNull":
      return "null"
    case "undefined":
    case "ZodUndefined":
      return "undefined"
    case "any":
    case "ZodAny":
      return "unknown"
    case "unknown":
    case "ZodUnknown":
      return "unknown"
    case "void":
    case "ZodVoid":
      return "void"
    case "date":
    case "ZodDate":
      return "Date"
    case "literal":
    case "ZodLiteral": {
      // Zod v4+ stores literal value in "values" array, v3 uses "value"
      const literalValue = typeDef.value ?? (typeDef.values as unknown[])?.[0]
      if (literalValue === undefined) {
        return "undefined"
      }
      return typeof literalValue === "string"
        ? `"${literalValue}"`
        : String(literalValue)
    }
    case "array":
    case "ZodArray": {
      // In Zod v4+, array element type is in "element"
      const elementSchema = typeDef.element as z.ZodType | undefined
      if (elementSchema) {
        const innerType = zodSchemaToTypeString(elementSchema, indent)
        return `${innerType}[]`
      }
      // Fallback for v3 which uses "type"
      const typeRef = typeDef.type as z.ZodType | undefined
      if (typeRef) {
        const innerType = zodSchemaToTypeString(typeRef, indent)
        return `${innerType}[]`
      }
      return "unknown[]"
    }
    case "optional":
    case "ZodOptional": {
      // In Zod v4+, inner type is in "innerType"
      const innerSchema =
        (typeDef.innerType as z.ZodType) || (typeDef.wrapped as z.ZodType)
      if (innerSchema) {
        const innerType = zodSchemaToTypeString(innerSchema, indent)
        return `${innerType} | undefined`
      }
      return "unknown | undefined"
    }
    case "nullable":
    case "ZodNullable": {
      const innerSchema =
        (typeDef.innerType as z.ZodType) || (typeDef.wrapped as z.ZodType)
      if (innerSchema) {
        const innerType = zodSchemaToTypeString(innerSchema, indent)
        return `${innerType} | null`
      }
      return "unknown | null"
    }
    case "object":
    case "ZodObject": {
      const shape = typeDef.shape as Record<string, z.ZodType> | undefined
      if (!shape || typeof shape !== "object") {
        return "Record<string, unknown>"
      }
      const props = Object.entries(shape)
        .map(([key, value]) => {
          const valueTypeName = getZodTypeName(value)
          const isOptional =
            valueTypeName === "optional" || valueTypeName === "ZodOptional"
          const propType = zodSchemaToTypeString(value, indent + 2)
          return `${"  ".repeat(indent / 2)}${key}${isOptional ? "?" : ""}: ${propType}`
        })
        .join("\n")
      return `{\n${props}\n${"  ".repeat(indent / 2 - 1)}}`
    }
    case "record":
    case "ZodRecord": {
      const valueSchema = typeDef.valueType as z.ZodType | undefined
      if (valueSchema) {
        const valueType = zodSchemaToTypeString(valueSchema, indent)
        return `Record<string, ${valueType}>`
      }
      return "Record<string, unknown>"
    }
    case "union":
    case "ZodUnion":
    case "discriminatedUnion":
    case "ZodDiscriminatedUnion": {
      const options = (typeDef.options as z.ZodType[]) || []
      if (options.length === 0) return "never"
      return options
        .map((opt) => zodSchemaToTypeString(opt, indent))
        .join(" | ")
    }
    case "enum":
    case "ZodEnum": {
      const values = (typeDef.values as string[]) || []
      if (values.length === 0) return "never"
      return values.map((v) => `"${v}"`).join(" | ")
    }
    case "nativeEnum":
    case "ZodNativeEnum": {
      return "unknown"
    }
    case "tuple":
    case "ZodTuple": {
      const items = (typeDef.items as z.ZodType[]) || []
      if (items.length === 0) return "[]"
      const types = items.map((item) => zodSchemaToTypeString(item, indent))
      return `[${types.join(", ")}]`
    }
    default:
      // Fallback for unhandled types
      return "unknown"
  }
}

/**
 * Generate client message type from registered handlers
 */
function generateClientMessageType(
  handlers: RegisteredMessageHandler[],
  indent: string,
): string {
  if (handlers.length === 0) {
    return `${indent}export type ClientMessage = never`
  }

  const types = handlers
    .map((handler) => {
      const dataType = zodSchemaToTypeString(handler.schema, 4)
      return `${indent}  | { type: "${handler.type}"; data: ${dataType} }`
    })
    .join("\n")

  return `${indent}export type ClientMessage =\n${types}`
}

/**
 * Generate TypeScript types for WebSocket routes
 * @param options - Generation options
 * @param localRegistry - Optional local WebSocket route registry (uses global if not provided)
 */
export async function generateWebSocketTypes(
  options: GenerateWebSocketTypesOptions,
  localRegistry?: WebSocketRouteRegistry,
): Promise<Result<string, Error>> {
  // Use local registry if provided, otherwise fall back to global
  const registry = localRegistry ?? webSocketRouteRegistry
  const routes = registry.getAll()
  const filteredRoutes = options.routes
    ? routes.filter((r) => options.routes?.includes(r.path))
    : routes

  if (filteredRoutes.length === 0) {
    return ok("")
  }

  const lines: string[] = [
    "// Auto-generated WebSocket types",
    "// Do not edit manually",
    "",
    "/* eslint-disable */",
    "/* prettier-ignore */",
    "",
    "/**",
    " * WebSocket Type Definitions",
    " * ",
    " * This file contains auto-generated types for WebSocket communication.",
    " * Both client->server and server->client message types are generated from Zod schemas.",
    " * ",
    " * Usage:",
    " * ```typescript",
    " * import { WsChatWebSocket } from './websocket-types'",
    " * ",
    " * // Client->server messages (auto-generated from .on() handlers)",
    " * const clientMessage: WsChatWebSocket.ClientMessage = {",
    " *   type: 'join',",
    " *   data: { roomId: 'room-123' }",
    " * }",
    " * ",
    " * // Server->client messages (auto-generated from .serverMessages() schema)",
    " * ws.onmessage = (event) => {",
    " *   const serverMessage: WsChatWebSocket.ServerMessage = JSON.parse(event.data)",
    " *   // Handle message with full type safety",
    " * }",
    " * ```",
    " */",
    "",
  ]

  for (const route of filteredRoutes) {
    const namespace = pathToNamespace(route.path)
    const indent = "  "

    lines.push(`/**`)
    lines.push(` * WebSocket route: ${route.path}`)
    lines.push(` */`)
    lines.push(`export namespace ${namespace} {`)

    // Generate ClientMessage type from handlers
    lines.push(generateClientMessageType(route.messageHandlers, indent))
    lines.push("")

    // Generate ServerMessage type from schema if available
    if (route.serverMessageSchema) {
      const serverMessageType = zodSchemaToTypeString(
        route.serverMessageSchema,
        2,
      )
      lines.push(`${indent}export type ServerMessage = ${serverMessageType}`)
    } else {
      // Fallback for routes without schema
      lines.push(
        `${indent}// ServerMessage schema not provided - define manually`,
      )
      lines.push(`${indent}export type ServerMessage = unknown`)
    }

    lines.push(`}`)
    lines.push("")
  }

  const content = lines.join("\n")

  return ok(content)
}

/** biome-ignore-all assist/source/organizeImports: tidy */

// Core Server API
export { createServer } from "./server"
export type { Server, ServerOptions } from "./types/server"

// HTTP Routes
export { createRoute } from "./http/route-builder"
export type { RouteContext, RouteHandler } from "./types/context"
export type { ExtractParams, HttpMethod, RouteMetadata } from "./types/route"

// WebSocket Routes
export { createWebSocketRoute } from "./websocket/websocket-route-builder"
export type {
  BinaryMessageHandler,
  CloseHandler,
  ConnectHandler,
  ErrorHandler as WebSocketErrorHandler,
  ExtractWsParams,
  MessageHandler,
  TypedWebSocket,
  WebSocketAuthFn,
  WebSocketContext,
  WebSocketData,
  WebSocketRouteDefinition,
} from "./types/websocket"
export type { WebSocketOptions } from "./types/server"

// WebSocket Authentication & Broadcasting
export {
  createTokenAuth,
  type ExtractedToken,
  extractBearerToken,
  extractQueryToken,
  extractRequestInfo,
  extractToken,
  noAuth,
  type TokenExtractionOptions,
} from "./websocket/websocket-auth"
export { webSocketRegistry } from "./websocket/websocket-handler"

// WebSocket Type Generation
export type { GenerateWebSocketTypesOptions } from "./websocket/websocket-type-generator"

// Middleware
export type { MiddlewareArgs, MiddlewareFn } from "./types/middleware"
export type { CorsOptions } from "./types/cors"

// Responses & Error Handling
export type { ErrorResponse, ResponseHelpers } from "./types/response"
export {
  CommonErrorResponses,
  ErrorCode,
  type ErrorCode as ErrorCodeType,
  ErrorResponseSchema,
} from "./standard-errors"
export { ValidationError } from "./validation"

// OpenAPI
export { SecuritySchemes } from "./openapi/security-schemes"
export type { OpenApiSpec } from "./types/server"

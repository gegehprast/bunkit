/** biome-ignore-all assist/source/organizeImports: tidy */

// Core Server API
export { createServer } from "./server"
export type {
  Server,
  ServerOptions,
  WebSocketOptions,
  RouteInfo,
  WebSocketRouteInfo,
  OpenApiSpec,
} from "./types/server"

// HTTP Routes
export { createRoute } from "./http/route-builder"
export type { RouteContext, RouteHandler } from "./http/types/context"
export type {
  ExtractParams,
  HttpMethod,
  RouteMetadata,
} from "./http/types/route"

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
} from "./websocket/types/websocket"

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
export {
  type GenerateWebSocketTypesOptions,
  generateWebSocketTypes,
} from "./websocket/websocket-type-generator"

// Middleware
export type { MiddlewareArgs, MiddlewareFn } from "./types/middleware"

// CORS
export type { CorsOptions } from "./types/cors"

// Responses & Error Handling
export type { ErrorResponse, ResponseHelpers } from "./http/types/response"
export {
  ErrorCode,
  type ErrorCode as ErrorCodeType,
  ErrorResponseSchema,
  BadRequestErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
  ForbiddenErrorResponseSchema,
  NotFoundErrorResponseSchema,
  ConflictErrorResponseSchema,
  InternalServerErrorResponseSchema,
  CommonErrorResponses,
} from "./core/standard-errors"
export { ValidationError } from "./core/validation"

// OpenAPI
export { SecuritySchemes } from "./http/openapi/security-schemes"
export { generateOpenApiSpec } from "./http/openapi/generator"

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirect
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const

/**
 * HTTP Methods
 */
export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
  OPTIONS: "OPTIONS",
  HEAD: "HEAD",
} as const

export type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS]

/**
 * Error Codes
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID: "AUTH_INVALID",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Validation
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",

  // WebSocket
  WS_MESSAGE_INVALID: "WS_MESSAGE_INVALID",
  WS_HANDLER_NOT_FOUND: "WS_HANDLER_NOT_FOUND",
  WS_RATE_LIMIT_EXCEEDED: "WS_RATE_LIMIT_EXCEEDED",

  // API Key authentication
  API_KEY_REQUIRED: "API_KEY_REQUIRED",
  API_KEY_INVALID: "API_KEY_INVALID",
  API_KEY_EXPIRED: "API_KEY_EXPIRED",
  API_KEY_DISABLED: "API_KEY_DISABLED",

  // Webhook gateway
  ENDPOINT_NOT_FOUND: "ENDPOINT_NOT_FOUND",
  ENDPOINT_DISABLED: "ENDPOINT_DISABLED",
  SIGNATURE_MISSING: "SIGNATURE_MISSING",
  SIGNATURE_INVALID: "SIGNATURE_INVALID",
  FILTER_ERROR: "FILTER_ERROR",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  DLQ_ERROR: "DLQ_ERROR",

  // Testing
  TEST_ERROR: "TEST_ERROR",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] & string

/**
 * API Response Headers
 */
export const HEADERS = {
  CONTENT_TYPE: "Content-Type",
  AUTHORIZATION: "Authorization",
  X_REQUEST_ID: "X-Request-ID",
  X_REQUESTED_WITH: "X-Requested-With",
  X_RATE_LIMIT_LIMIT: "X-RateLimit-Limit",
  X_RATE_LIMIT_REMAINING: "X-RateLimit-Remaining",
  X_RATE_LIMIT_RESET: "X-RateLimit-Reset",
  X_RESPONSE_TIME: "X-Response-Time",
} as const

/**
 * Content Types
 */
export const CONTENT_TYPES = {
  JSON: "application/json",
  TEXT: "text/plain",
  HTML: "text/html",
  XML: "application/xml",
  FORM: "application/x-www-form-urlencoded",
  MULTIPART: "multipart/form-data",
} as const

/**
 * Delivery worker defaults
 */
export const DELIVERY_DEFAULTS = {
  /** Maximum number of delivery attempts before moving to DLQ */
  MAX_RETRIES: 3,
  /** Base backoff interval in seconds (multiplied by attempt number) */
  RETRY_BACKOFF_SECONDS: 60,
  /** How often the delivery worker polls for pending attempts (ms) */
  WORKER_POLL_INTERVAL_MS: 2000,
  /** HTTP timeout for outbound delivery requests (ms) */
  DELIVERY_TIMEOUT_MS: 10000,
  /** Maximum delivery response body stored (bytes) */
  MAX_RESPONSE_BODY_BYTES: 4096,
} as const

/**
 * Webhook-specific request headers
 */
export const WEBHOOK_HEADERS = {
  /** Inbound signature header names per scheme */
  GITHUB_SIGNATURE: "x-hub-signature-256",
  STRIPE_SIGNATURE: "stripe-signature",
  SVIX_SIGNATURE: "svix-signature",
  SVIX_TIMESTAMP: "svix-timestamp",
  SVIX_MSG_ID: "svix-id",
  /** Generic HMAC header used when no vendor scheme is specified */
  GENERIC_SIGNATURE: "x-webhook-signature",
  /** Hookitup-generated event ID forwarded to delivery targets */
  HOOKITUP_EVENT_ID: "x-hookitup-event-id",
  /** Hookitup outbound signature header */
  HOOKITUP_SIGNATURE: "x-hookitup-signature",
} as const

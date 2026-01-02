/**
 * OpenAPI 3.1 Security Scheme Templates
 * Provides common authentication/authorization schemes
 */

export interface SecuritySchemeObject {
  type: "http" | "apiKey" | "oauth2" | "openIdConnect"
  scheme?: string
  bearerFormat?: string
  description?: string
  name?: string
  in?: "query" | "header" | "cookie"
  flows?: {
    authorizationCode?: {
      authorizationUrl: string
      tokenUrl: string
      scopes: Record<string, string>
      refreshUrl?: string
    }
    implicit?: {
      authorizationUrl: string
      scopes: Record<string, string>
      refreshUrl?: string
    }
    password?: {
      tokenUrl: string
      scopes: Record<string, string>
      refreshUrl?: string
    }
    clientCredentials?: {
      tokenUrl: string
      scopes: Record<string, string>
      refreshUrl?: string
    }
  }
  openIdConnectUrl?: string
  // Allow OpenAPI extension fields
  [key: `x-${string}`]: unknown
}

/**
 * Common security scheme templates
 */
export const SecuritySchemes = {
  /**
   * HTTP Bearer authentication (JWT)
   * Usage: Authorization: Bearer <token>
   */
  bearerAuth: (
    description = "JWT authorization token",
  ): SecuritySchemeObject => ({
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description,
  }),

  /**
   * HTTP Basic authentication
   * Usage: Authorization: Basic <base64>
   */
  basicAuth: (
    description = "HTTP Basic authentication",
  ): SecuritySchemeObject => ({
    type: "http",
    scheme: "basic",
    description,
  }),

  /**
   * API Key in header
   * Usage: X-API-Key: <key>
   */
  apiKeyHeader: (
    name = "X-API-Key",
    description = "API key in header",
  ): SecuritySchemeObject => ({
    type: "apiKey",
    in: "header",
    name,
    description,
  }),

  /**
   * API Key in query parameter
   * Usage: ?api_key=<key>
   */
  apiKeyQuery: (
    name = "api_key",
    description = "API key in query parameter",
  ): SecuritySchemeObject => ({
    type: "apiKey",
    in: "query",
    name,
    description,
  }),

  /**
   * API Key in cookie
   * Usage: Cookie: session=<key>
   */
  apiKeyCookie: (
    name = "session",
    description = "API key in cookie",
  ): SecuritySchemeObject => ({
    type: "apiKey",
    in: "cookie",
    name,
    description,
  }),

  /**
   * OAuth2 Authorization Code flow
   */
  oauth2AuthCode: (
    authorizationUrl: string,
    tokenUrl: string,
    scopes: Record<string, string> = {},
    refreshUrl?: string,
  ): SecuritySchemeObject => ({
    type: "oauth2",
    flows: {
      authorizationCode: {
        authorizationUrl,
        tokenUrl,
        scopes,
        refreshUrl,
      },
    },
  }),

  /**
   * OAuth2 Implicit flow
   */
  oauth2Implicit: (
    authorizationUrl: string,
    scopes: Record<string, string> = {},
    refreshUrl?: string,
  ): SecuritySchemeObject => ({
    type: "oauth2",
    flows: {
      implicit: {
        authorizationUrl,
        scopes,
        refreshUrl,
      },
    },
  }),

  /**
   * OAuth2 Password flow
   */
  oauth2Password: (
    tokenUrl: string,
    scopes: Record<string, string> = {},
    refreshUrl?: string,
  ): SecuritySchemeObject => ({
    type: "oauth2",
    flows: {
      password: {
        tokenUrl,
        scopes,
        refreshUrl,
      },
    },
  }),

  /**
   * OAuth2 Client Credentials flow
   */
  oauth2ClientCredentials: (
    tokenUrl: string,
    scopes: Record<string, string> = {},
    refreshUrl?: string,
  ): SecuritySchemeObject => ({
    type: "oauth2",
    flows: {
      clientCredentials: {
        tokenUrl,
        scopes,
        refreshUrl,
      },
    },
  }),

  /**
   * OpenID Connect Discovery
   */
  openIdConnect: (
    openIdConnectUrl: string,
    description = "OpenID Connect authentication",
  ): SecuritySchemeObject => ({
    type: "openIdConnect",
    openIdConnectUrl,
    description,
  }),
} as const

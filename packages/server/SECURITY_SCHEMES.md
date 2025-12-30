# Security Schemes Configuration

The `@bunkit/server` package provides flexible security scheme configuration with templates for common authentication methods.

## Usage

### 1. Import Security Schemes

```typescript
import { createServer, SecuritySchemes } from "@bunkit/server"
```

### 2. Configure Security Schemes

Pass security schemes to `createServer`:

```typescript
const server = createServer({
  openapi: {
    title: "My API",
    version: "1.0.0",
    securitySchemes: {
      // Use pre-built templates
      bearerAuth: SecuritySchemes.bearerAuth(),
      apiKey: SecuritySchemes.apiKeyHeader(),
    },
  },
})
```

### 3. Apply Security to Routes

Reference the configured scheme names in your routes:

```typescript
createRoute("GET", "/api/protected")
  .security([{ bearerAuth: [] }])
  .handler(({ res }) => res.ok({ message: "Protected data" }))
```

## Available Templates

### HTTP Bearer (JWT)

```typescript
bearerAuth: SecuritySchemes.bearerAuth()
// Custom description:
bearerAuth: SecuritySchemes.bearerAuth("Custom JWT token")
```

### HTTP Basic Authentication

```typescript
basicAuth: SecuritySchemes.basicAuth()
// Custom description:
basicAuth: SecuritySchemes.basicAuth("Basic auth credentials")
```

### API Key in Header

```typescript
apiKey: SecuritySchemes.apiKeyHeader()
// Custom header name:
apiKey: SecuritySchemes.apiKeyHeader("X-Custom-Key", "My custom API key")
```

### API Key in Query Parameter

```typescript
apiKey: SecuritySchemes.apiKeyQuery()
// Custom parameter name:
apiKey: SecuritySchemes.apiKeyQuery("token", "API token in query")
```

### API Key in Cookie

```typescript
sessionAuth: SecuritySchemes.apiKeyCookie()
// Custom cookie name:
sessionAuth: SecuritySchemes.apiKeyCookie("auth_token", "Session cookie")
```

### OAuth2 Authorization Code Flow

```typescript
oauth: SecuritySchemes.oauth2AuthCode(
  "https://auth.example.com/oauth/authorize",
  "https://auth.example.com/oauth/token",
  {
    "read:users": "Read user data",
    "write:users": "Modify user data",
  },
  "https://auth.example.com/oauth/refresh" // Optional refresh URL
)
```

### OAuth2 Implicit Flow

```typescript
oauth: SecuritySchemes.oauth2Implicit(
  "https://auth.example.com/oauth/authorize",
  {
    "read:data": "Read access",
  }
)
```

### OAuth2 Password Flow

```typescript
oauth: SecuritySchemes.oauth2Password(
  "https://auth.example.com/oauth/token",
  {
    "read:data": "Read access",
    "write:data": "Write access",
  }
)
```

### OAuth2 Client Credentials Flow

```typescript
oauth: SecuritySchemes.oauth2ClientCredentials(
  "https://auth.example.com/oauth/token",
  {
    "api:access": "API access",
  }
)
```

### OpenID Connect

```typescript
oidc: SecuritySchemes.openIdConnect(
  "https://auth.example.com/.well-known/openid-configuration"
)
```

## Multiple Security Schemes

You can configure multiple security schemes and use different ones for different routes:

```typescript
const server = createServer({
  openapi: {
    title: "Multi-Auth API",
    version: "1.0.0",
    securitySchemes: {
      bearerAuth: SecuritySchemes.bearerAuth(),
      apiKey: SecuritySchemes.apiKeyHeader("X-API-Key"),
      basicAuth: SecuritySchemes.basicAuth(),
    },
  },
})

// Route using bearer token
createRoute("GET", "/api/users")
  .security([{ bearerAuth: [] }])
  .handler(...)

// Route using API key
createRoute("GET", "/api/public-data")
  .security([{ apiKey: [] }])
  .handler(...)

// Route supporting multiple auth methods (OR logic)
createRoute("GET", "/api/flexible")
  .security([{ bearerAuth: [] }, { apiKey: [] }])
  .handler(...)
```

## Custom Security Schemes

For custom requirements, use `createSecurityScheme`:

```typescript
import { createSecurityScheme } from "@bunkit/server"

const server = createServer({
  openapi: {
    securitySchemes: {
      custom: createSecurityScheme({
        type: "apiKey",
        in: "header",
        name: "X-Custom-Auth",
        description: "My custom authentication",
      }),
    },
  },
})
```

## Example: Real-World Configuration

```typescript
import { createServer, SecuritySchemes } from "@bunkit/server"

const server = createServer({
  port: 3000,
  openapi: {
    title: "My Production API",
    version: "2.0.0",
    description: "Production API with multiple auth methods",
    securitySchemes: {
      // JWT for user authentication
      jwt: SecuritySchemes.bearerAuth("JWT access token"),
      
      // API key for service-to-service
      apiKey: SecuritySchemes.apiKeyHeader("X-API-Key", "Service API key"),
      
      // OAuth2 for third-party integrations
      oauth2: SecuritySchemes.oauth2AuthCode(
        "https://auth.myapp.com/oauth/authorize",
        "https://auth.myapp.com/oauth/token",
        {
          "read:profile": "Read user profile",
          "write:profile": "Update user profile",
          "read:data": "Read application data",
          "write:data": "Modify application data",
        }
      ),
    },
  },
})

// User endpoints with JWT
createRoute("GET", "/api/user/profile")
  .security([{ jwt: [] }])
  .handler(...)

// Service endpoints with API key
createRoute("POST", "/api/webhooks/process")
  .security([{ apiKey: [] }])
  .handler(...)

// Third-party integration with OAuth2
createRoute("GET", "/api/integration/data")
  .security([{ oauth2: ["read:data"] }])
  .handler(...)
```

## Swagger UI Integration

When you configure security schemes, the Swagger UI automatically displays an "Authorize" button where users can:

1. Enter JWT tokens
2. Provide API keys
3. Complete OAuth2 flows
4. Enter Basic auth credentials

The UI will then include the appropriate authentication in all test requests.

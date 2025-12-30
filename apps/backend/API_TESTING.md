# API Testing Guide

This document shows how to test all the API endpoints.

## Authentication Flow

### 1. Register a new user
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

Response:
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

### 2. Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 3. Get current user
```bash
TOKEN="your-jwt-token-here"

curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## Todo Management

### List all todos
```bash
curl http://localhost:3001/api/todos \
  -H "Authorization: Bearer $TOKEN"
```

### Create a todo
```bash
curl -X POST http://localhost:3001/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries",
    "description": "Milk, Bread, Eggs"
  }'
```

### Get a specific todo
```bash
TODO_ID="todo-id-here"

curl http://localhost:3001/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Update a todo
```bash
curl -X PUT http://localhost:3001/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries",
    "completed": true
  }'
```

### Delete a todo
```bash
curl -X DELETE http://localhost:3001/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN"
```

## Documentation & Static Files

### Home page
```bash
curl http://localhost:3001/
```

### API Documentation (Swagger UI)
Open in browser: http://localhost:3001/docs

### OpenAPI Specification
```bash
curl http://localhost:3001/openapi.json | jq
```

### Refresh OpenAPI cache
```bash
curl -X POST http://localhost:3001/openapi/refresh
```

### Health check
```bash
curl http://localhost:3001/api/health
```

### Static files
```bash
curl http://localhost:3001/public/favicon.ico
```

## Complete Workflow Example

```bash
#!/bin/bash

# 1. Register
RESPONSE=$(curl -s -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123","name":"Demo User"}')

TOKEN=$(echo $RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# 2. Create a todo
TODO=$(curl -s -X POST http://localhost:3001/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Todo","description":"This is a test"}')

TODO_ID=$(echo $TODO | jq -r '.id')
echo "Created todo: $TODO_ID"

# 3. List todos
curl -s http://localhost:3001/api/todos \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Update todo
curl -s -X PUT http://localhost:3001/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"completed":true}' | jq

# 5. Delete todo
curl -s -X DELETE http://localhost:3001/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Query Parameters

### Filter todos by completion status
```bash
# Get completed todos
curl "http://localhost:3001/api/todos?completed=true" \
  -H "Authorization: Bearer $TOKEN"

# Get incomplete todos
curl "http://localhost:3001/api/todos?completed=false" \
  -H "Authorization: Bearer $TOKEN"

# Limit results
curl "http://localhost:3001/api/todos?limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

## Error Responses

### 401 Unauthorized
Missing or invalid token:
```json
{
  "message": "Authentication failed",
  "code": "AUTHENTICATION_FAILED"
}
```

### 403 Forbidden
Accessing another user's resource:
```json
{
  "message": "Access denied"
}
```

### 404 Not Found
Resource doesn't exist:
```json
{
  "message": "Todo not found"
}
```

### 400 Bad Request
Invalid input:
```json
{
  "message": "Email already registered",
  "code": "EMAIL_EXISTS"
}
```

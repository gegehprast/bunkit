export async function loadRoutes() {
  // HTTP routes
  await import("@/routes/home.routes")
  await import("@/routes/static.routes")
  await import("@/routes/health.routes")
  await import("@/routes/docs.routes")
  await import("@/routes/auth.routes")
  await import("@/routes/todos.routes")

  // WebSocket routes
  await import("@/routes/chat.websocket")
}

// HTTP routes
import "@/routes/home.routes"
import "@/routes/health.routes"
import "@/routes/docs.routes"

// Gateway
import "@/routes/hooks.routes"

// Admin API
import "@/routes/auth.routes"
import "@/routes/setup.routes"
import "@/routes/api-keys.routes"
import "@/routes/endpoints.routes"
import "@/routes/targets.routes"
import "@/routes/test-receivers.routes"
import "@/routes/send-test.routes"
import "@/routes/rules.routes"
import "@/routes/events.routes"
import "@/routes/dlq.routes"

// WebSocket
import "@/routes/events.websocket"

// Test receiver capture (no auth, token in URL)
import "@/routes/test-receiver-capture.routes"

// Static / SPA — must be last (wildcard catch-all)
import "@/routes/static.routes"

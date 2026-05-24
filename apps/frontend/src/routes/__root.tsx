import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import {
  createRootRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { authService, setupService } from "../lib/api-service"

const navItems = [
  { to: "/endpoints", label: "Endpoints", icon: "🔌" },
  { to: "/events", label: "Events", icon: "📋" },
  { to: "/dlq", label: "DLQ", icon: "💀" },
  { to: "/keys", label: "API Keys", icon: "🔑" },
  { to: "/feed", label: "Live Feed", icon: "📡" },
]

function RootLayout() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isLogin = pathname === "/login"

  function handleSignOut() {
    authService.logout()
    navigate({ to: "/login" })
  }

  // Login and setup pages render full-screen without the shell
  if (isLogin || pathname === "/setup") {
    return (
      <>
        <Outlet />
        {import.meta.env.DEV && (
          <ReactQueryDevtools buttonPosition="bottom-right" />
        )}
      </>
    )
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white">
        <div className="flex h-16 items-center border-b border-zinc-200 px-4">
          <span className="text-lg font-bold text-zinc-900">hookitup</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              activeProps={{
                className:
                  "bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-50 hover:text-indigo-700",
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-200 px-4 py-3">
          <p className="mb-2 text-xs text-zinc-400">Webhook Gateway</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-zinc-500 hover:text-zinc-900"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>

      {import.meta.env.DEV && (
        <ReactQueryDevtools buttonPosition="bottom-right" />
      )}
    </div>
  )
}

export const Route = createRootRoute({
  async beforeLoad({ location }) {
    const pathname = location.pathname
    const isSetupPage = pathname === "/setup"
    const isLoginPage = pathname === "/login"

    // Check if setup is needed (skip the check if already on /setup)
    if (!isSetupPage) {
      const { data } = await setupService.status().catch(() => ({ data: null }))
      if (data?.needsSetup) {
        throw redirect({ to: "/setup" })
      }
    }

    // Check authentication via cookie (GET /api/auth/me returns 401 if not authed)
    if (!isLoginPage && !isSetupPage) {
      const { error } = await authService.me().catch(() => ({ error: true }))
      if (error) {
        throw redirect({ to: "/login" })
      }
    }
  },
  component: RootLayout,
})

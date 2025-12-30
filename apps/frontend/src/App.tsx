import { Auth } from "./components/Auth"
import { TodoList } from "./components/TodoList"
import { AuthProvider, useAuth } from "./hooks/useAuth"

const AppContent = () => {
  const { user, isLoading, isAuthenticated, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Auth />
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-blue-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            BunStart Todo App
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">
              Welcome,{" "}
              <span className="font-semibold">{user?.name || user?.email}</span>
              !
            </span>
            <button
              type="button"
              onClick={logout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TodoList />
      </main>
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-600">
          <p>
            Built with{" "}
            <span className="font-semibold text-blue-600">BunStart</span> -
            Type-safe API client demo
          </p>
        </div>
      </footer>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App

import { useState } from "react"
import { Auth } from "./components/Auth"
import { Chat } from "./components/Chat"
import { TodoList } from "./components/TodoList"
import { AuthProvider, useAuth } from "./hooks/useAuth"
import { ChatProvider } from "./hooks/useChat"

const AppContent = () => {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<"todos" | "chat">("todos")

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
    <div className="flex flex-col h-screen bg-linear-to-br from-gray-50 to-blue-50">
      <header className="bg-white shadow-sm border-b border-gray-200 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">BunStart App</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">
                Welcome,{" "}
                <span className="font-semibold">
                  {user?.name || user?.email}
                </span>
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

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab("todos")}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === "todos"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === "chat"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Chat
            </button>
          </div>
        </div>
      </header>

      {activeTab === "todos" ? (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <TodoList />
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-hidden">
          <Chat />
        </main>
      )}

      <footer className="bg-white border-t border-gray-200 shrink-0">
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
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </AuthProvider>
  )
}

export default App

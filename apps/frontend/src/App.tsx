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
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ff73a8]" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Auth />
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="bg-gray-900 shadow-sm border-b border-gray-800 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-2xl font-bold text-white">BunKit Frontend</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">
                Welcome,{" "}
                <span className="font-semibold text-[#ff73a8]">
                  {user?.name || user?.email}
                </span>
                !
              </span>
              <button
                type="button"
                onClick={logout}
                className="bg-gray-800 hover:bg-gray-700 text-gray-100 font-semibold px-4 py-2 rounded-lg transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab("todos")}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === "todos"
                  ? "border-[#ff73a8] text-[#ff73a8]"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === "chat"
                  ? "border-[#ff73a8] text-[#ff73a8]"
                  : "border-transparent text-gray-400 hover:text-gray-200"
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
          <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Chat />
          </div>
        </main>
      )}

      <footer className="bg-gray-900 border-t border-gray-800 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-400">
          <p>
            Built with{" "}
            <span className="font-semibold text-[#ff73a8]">BunKit</span> -
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

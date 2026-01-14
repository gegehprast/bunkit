import { useState } from "react"
import { useAuth, type ValidationDetail } from "../hooks/useAuth"

export const Auth = () => {
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [validationErrors, setValidationErrors] = useState<ValidationDetail[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setValidationErrors([])
    setIsLoading(true)

    const result = isLogin
      ? await login(email, password)
      : await register(email, password, name)

    setIsLoading(false)

    if (!result.success) {
      setError(result.error || "Operation failed")
      if (result.validationErrors) {
        setValidationErrors(result.validationErrors)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-[#ff73a8] focus:border-transparent outline-none transition"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-[#ff73a8] focus:border-transparent outline-none transition"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-[#ff73a8] focus:border-transparent outline-none transition"
          />
          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg text-sm">
              <div className="font-semibold mb-1">{error}</div>
              {validationErrors.length > 0 && (
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {validationErrors.map((err, index) => (
                    <li key={index}>
                      <span className="font-medium">{err.field}:</span>{" "}
                      {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#ff73a8] hover:bg-[#ff5a93] disabled:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg"
          >
            {isLoading ? "Loading..." : isLogin ? "Login" : "Register"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin)
            setError("")
            setValidationErrors([])
          }}
          className="w-full mt-4 text-[#ff73a8] hover:text-[#ff5a93] font-medium py-2 transition"
        >
          {isLogin ? "Need an account? Register" : "Have an account? Login"}
        </button>
      </div>
    </div>
  )
}

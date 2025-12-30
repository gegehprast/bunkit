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
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
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
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg"
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
          className="w-full mt-4 text-blue-600 hover:text-blue-700 font-medium py-2 transition"
        >
          {isLogin ? "Need an account? Register" : "Have an account? Login"}
        </button>
      </div>
    </div>
  )
}

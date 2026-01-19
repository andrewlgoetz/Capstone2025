import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { loginUser, fetchCurrentUser } from '../services/api'

const AuthContext = createContext(null)

const getStoredToken = () => localStorage.getItem('authToken')

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setLoading(false)
      return
    }

    fetchCurrentUser()
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem('authToken')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const data = await loginUser({ email, password })
    localStorage.setItem('authToken', data.access_token)
    const me = await fetchCurrentUser()
    setUser(me)
    return me
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { authApi } from '../lib/api'

interface User { user_id: string; email: string; role_id: string }
interface Ctx { user: User|null; token: string|null; login(e:string,p:string):Promise<void>; logout():void; isAdmin:boolean; isAnalyst:boolean }

const AuthCtx = createContext<Ctx|null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string|null>(() => localStorage.getItem('token'))
  const [user, setUser]   = useState<User|null>(() => { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null })

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password)
    localStorage.setItem('token', data.access_token)
    const u = { user_id: data.user_id, email: data.email, role_id: data.role }
    localStorage.setItem('user', JSON.stringify(u))
    setToken(data.access_token); setUser(u)
  }
  const logout = () => { localStorage.clear(); setToken(null); setUser(null) }

  return (
    <AuthCtx.Provider value={{ user, token, login, logout,
      isAdmin: user?.role_id === 'admin',
      isAnalyst: ['admin','soc_analyst'].includes(user?.role_id ?? '') }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}

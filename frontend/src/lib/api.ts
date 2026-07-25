import axios from 'axios'

export const api = axios.create({ baseURL: '/api/v1' })

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { localStorage.clear(); window.location.href = '/login' }
  return Promise.reject(err)
})

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
}
export const statsApi = { summary: (range = '7d') => api.get(`/stats/summary?range=${range}`).then(r => r.data) }
export const logsApi = {
  list: (p?: any) => api.get('/logs/prompts', { params: p }).then(r => r.data),
  get: (id: string) => api.get(`/logs/prompts/${id}`).then(r => r.data),
}
export const rulesApi = {
  list: () => api.get('/rules').then(r => r.data),
  create: (b: any) => api.post('/rules', b).then(r => r.data),
  update: (id: string, b: any) => api.patch(`/rules/${id}`, b).then(r => r.data),
  delete: (id: string) => api.delete(`/rules/${id}`),
}
export const proxyApi = {
  inspect: (msgs: { role: string; content: string }[]) =>
    api.post('/proxy/inspect', { messages: msgs }).then(r => r.data),
}
export const redteamApi = {
  run: (b: any) => api.post('/redteam/run', b).then(r => r.data),
}
export const auditApi = { list: () => api.get('/audit-log').then(r => r.data) }

export const userApi = {
  list: () => api.get('/users').then(r => r.data),
  create: (b: any) => api.post('/auth/register', b).then(r => r.data),
  update: (id: string, b: any) => api.patch(`/users/${id}`, b).then(r => r.data),
  delete: (id: string) => api.delete(`/users/${id}`),
}

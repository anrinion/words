import { api } from './client'

export const authApi = {
  me: () => api.get<{ email: string }>('/api/auth/me'),
  sendOtp: (email: string) => api.post<{ ok: boolean }>('/api/auth/send-otp', { email }),
  verifyOtp: (email: string, code: string) => api.post<{ email: string }>('/api/auth/verify-otp', { email, code }),
  logout: () => api.post<{ ok: boolean }>('/api/auth/logout', {}),
}

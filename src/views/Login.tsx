import { useState } from 'react'
import { authApi } from '../api/auth'

export default function Login({ onLogin }: { onLogin: (email: string) => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendCode() {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await authApi.sendOtp(email.trim())
      setStep('code')
    } catch {
      setError('Failed to send code. Check your email address.')
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    if (code.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const { email: verified } = await authApi.verifyOtp(email, code)
      onLogin(verified)
    } catch {
      setError('Invalid or expired code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-dvh bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Words</h1>
        <p className="text-sm text-slate-500 mb-6">Sign in to continue</p>

        {step === 'email' ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email address</label>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendCode() }}
                placeholder="you@example.com"
                className="input"
              />
            </div>
            <button
              type="button"
              onClick={sendCode}
              disabled={loading || !email.trim()}
              className={`btn-primary w-full ${loading || !email.trim() ? 'opacity-40' : ''}`}
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Code sent to <strong>{email}</strong>
            </p>
            <div>
              <label className="block text-sm text-slate-600 mb-1">6-digit code</label>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') verify() }}
                placeholder="123456"
                className="input"
              />
            </div>
            <button
              type="button"
              onClick={verify}
              disabled={loading || code.length !== 6}
              className={`btn-primary w-full ${loading || code.length !== 6 ? 'opacity-40' : ''}`}
            >
              {loading ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError('') }}
              className="text-sm text-slate-500 hover:text-slate-700 text-center"
            >
              ← Use a different email
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  )
}

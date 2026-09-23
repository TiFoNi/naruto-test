import { useState, type FormEvent } from 'react'
import { useAuth } from './auth'
import { useI18n } from './i18n'

type Mode = 'login' | 'register'

type PasswordFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  visible: boolean
  onToggle?: () => void
}

function PasswordField({ label, value, onChange, autoComplete, visible, onToggle }: PasswordFieldProps) {
  const { t } = useI18n()
  return (
    <label>
      {label}
      <span className="password-field">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          maxLength={100}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        {onToggle && (
          <button
            type="button"
            className="reveal"
            aria-label={t(visible ? 'auth.hide' : 'auth.show')}
            aria-pressed={visible}
            onClick={onToggle}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path
                d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              {visible && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
            </svg>
          </button>
        )}
      </span>
    </label>
  )
}

export default function AuthScreen() {
  const { submit } = useAuth()
  const { t, error: errorText } = useI18n()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'register' && password !== repeat) return setError(t('auth.mismatch'))
    setBusy(true)
    const code = await submit(mode, username, password)
    setError(code ? errorText(code) : null)
    setBusy(false)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  return (
    <form className="card auth" onSubmit={onSubmit}>
      <div className="auth-tabs">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
          {t('auth.login')}
        </button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
          {t('auth.register')}
        </button>
      </div>
      <label>
        {t('auth.username')}
        <input
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          maxLength={64}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </label>
      <PasswordField
        label={t('auth.password')}
        value={password}
        onChange={setPassword}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        visible={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
      />
      {mode === 'register' && (
        <PasswordField label={t('auth.repeat')} value={repeat} onChange={setRepeat} autoComplete="new-password" visible={showPassword} />
      )}
      {error && <div className="auth-error">{error}</div>}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? t('auth.busy') : t(mode === 'login' ? 'auth.submitLogin' : 'auth.submitRegister')}
      </button>
    </form>
  )
}

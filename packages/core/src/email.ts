import { isDisposableEmailDomain } from 'disposable-email-domains-js'

const GMAIL = new Set(['gmail.com', 'googlemail.com'])

const partsOf = (email: string) => {
  const clean = email.trim().toLowerCase()
  const at = clean.lastIndexOf('@')
  return at < 0 ? { name: clean, domain: '' } : { name: clean.slice(0, at), domain: clean.slice(at + 1) }
}

export function throwaway(email: string) {
  const labels = partsOf(email).domain.split('.').filter(Boolean)
  for (let start = 0; start < labels.length - 1; start++) {
    if (isDisposableEmailDomain(labels.slice(start).join('.'))) return true
  }
  return false
}

export function mailKey(email: string) {
  const { name, domain } = partsOf(email)
  const base = name.split('+')[0] ?? name
  return GMAIL.has(domain) ? `${base.replaceAll('.', '')}@gmail.com` : `${base}@${domain}`
}

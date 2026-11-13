const DEVICE_KEY = 'play:device'

export const deviceId = () => {
  try {
    const kept = localStorage.getItem(DEVICE_KEY)
    if (kept) return kept
    const made = Array.from(crypto.getRandomValues(new Uint8Array(12)), (one) => one.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(DEVICE_KEY, made)
    return made
  } catch {
    return undefined
  }
}

export const deviceName = () => {
  const agent = navigator.userAgent
  const os = /iPhone/.test(agent) ? 'iPhone' : /iPad/.test(agent) ? 'iPad' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'Mac' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : ''
  const browser = /YaBrowser/.test(agent)
    ? 'Yandex'
    : /Edg\//.test(agent)
      ? 'Edge'
      : /OPR\//.test(agent)
        ? 'Opera'
        : /Firefox|FxiOS/.test(agent)
          ? 'Firefox'
          : /Chrome|CriOS/.test(agent)
            ? 'Chrome'
            : /Safari/.test(agent)
              ? 'Safari'
              : ''
  return [os, browser].filter(Boolean).join(' · ')
}

/** Last-known data per key, so the wall still shows something useful when the internet drops. */
const PREFIX = 'fsc_cache:'

export function cacheGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as { v: T }).v : undefined
  } catch { return undefined }
}

/** Forget everything cached (on sign-out, so a shared screen never shows the last family's data). */
export function cacheClear() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)) } catch { /* blocked */ }
}

export function cacheSet(key: string, value: unknown) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, at: Date.now() })) } catch { /* full or blocked: skip */ }
}

const KEY = 'fsc_muted'

/** Per-device mute (school nights). Stored in this browser only. */
export function isMuted(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setMuted(muted: boolean) {
  try { localStorage.setItem(KEY, muted ? '1' : '0') } catch { /* storage blocked: mute lasts this session only */ }
  window.dispatchEvent(new Event('fsc-mute'))
}

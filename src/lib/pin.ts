const SALT = 'family-smart-calendar'

/** SHA-256 of salt + pin, hex. Good enough for a wall-screen PIN; the real guard is Supabase Auth. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPin(pin: string, hash: string | null): Promise<boolean> {
  if (!hash) return false
  return (await hashPin(pin)) === hash
}

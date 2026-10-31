export type Role = 'parent' | 'kid' | 'guest'
export type ReadingLevel = 'icons' | 'text'

export interface FamilyMember {
  id: string
  name: string
  role: Role
  avatar: string | null
  colour: string
  pin_hash: string | null
  sort_order: number
  birthdate: string | null
  reading_level: ReadingLevel
}

export const MEMBER_COLOURS = ['#2BB3A0', '#F26B5B', '#8B6CE6', '#3E8EE0', '#2E9E63', '#F2A51A', '#B53E6E', '#6B7A1F'] as const

export function ageFromBirthdate(birthdate: string | null, today = new Date()): number | null {
  if (!birthdate) return null
  const b = new Date(birthdate)
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return age
}

/** Pre-readers get icon-first tiles. */
export function defaultReadingLevel(age: number | null): ReadingLevel {
  return age !== null && age < 7 ? 'icons' : 'text'
}

export const IDENTITY_KEY = 'family-calendar.member'
export const IDENTITY_SEEN_KEY = 'family-calendar.seen'

export function readIdentityId(): number | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(IDENTITY_KEY)
  const id = raw ? Number(raw) : Number.NaN
  return Number.isInteger(id) ? id : null
}

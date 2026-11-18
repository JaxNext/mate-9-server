import { IDENTITY_KEY, IDENTITY_SEEN_KEY, readIdentityId } from '~/utils/identity'

export function useIdentity() {
  const memberId = useState<number | null>('fc-identity', readIdentityId)
  const seen = useState<boolean>(
    'fc-identity-seen',
    () => typeof window !== 'undefined' && window.localStorage.getItem(IDENTITY_SEEN_KEY) === '1',
  )

  function setIdentity(id: number) {
    memberId.value = id
    if (typeof window !== 'undefined') window.localStorage.setItem(IDENTITY_KEY, String(id))
  }

  function clearIdentity() {
    memberId.value = null
    if (typeof window !== 'undefined') window.localStorage.removeItem(IDENTITY_KEY)
  }

  function markSeen() {
    seen.value = true
    if (typeof window !== 'undefined') window.localStorage.setItem(IDENTITY_SEEN_KEY, '1')
  }

  return { memberId, seen, setIdentity, clearIdentity, markSeen }
}

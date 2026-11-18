import { readIdentityId } from '~/utils/identity'

/**
 * 写操作统一带上本机身份；读接口忽略该头。
 */
export function useApi() {
  return $fetch.create({
    onRequest({ options }) {
      const id = readIdentityId()
      if (!id) return
      const headers = new Headers(options.headers as HeadersInit | undefined)
      headers.set('x-member-id', String(id))
      options.headers = headers
    },
  })
}

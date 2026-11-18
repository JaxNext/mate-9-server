import { useDb } from '../../utils/db'
import { findOrCreateMember, normalizeMemberName } from '../../utils/members'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown> | null
  const name = normalizeMemberName(body?.name)

  const result = findOrCreateMember(useDb(), name)
  if (result.created) setResponseStatus(event, 201)
  return result
})

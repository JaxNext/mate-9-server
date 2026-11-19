import { useDb } from '../../utils/db'
import { requireMember } from '../../utils/auth'
import { findOrCreateTag, normalizeTagColor, normalizeTagName } from '../../utils/tags'

export default defineEventHandler(async (event) => {
  requireMember(event)

  const body = (await readBody(event)) as Record<string, unknown> | null
  const name = normalizeTagName(body?.name)
  const color = normalizeTagColor(body?.color)

  const result = findOrCreateTag(useDb(), name, color)
  if (result.created) setResponseStatus(event, 201)
  return result
})

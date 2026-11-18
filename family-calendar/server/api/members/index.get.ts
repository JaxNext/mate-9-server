import { useDb } from '../../utils/db'
import { listMembers } from '../../utils/members'

export default defineEventHandler(() => {
  return listMembers(useDb())
})

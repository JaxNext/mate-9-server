import { useDb } from '../../utils/db'
import { listTags } from '../../utils/tags'

export default defineEventHandler(() => {
  return listTags(useDb())
})

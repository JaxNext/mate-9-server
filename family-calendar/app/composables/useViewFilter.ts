export type ViewFilter = 'all' | 'mine'

const FILTER_KEY = 'family-calendar.filter'
const FILTER_STATE = 'fc-view-filter'

export function useViewFilter() {
  const { memberId } = useIdentity()

  const filter = useState<ViewFilter>(FILTER_STATE, () => {
    if (typeof window === 'undefined') return 'all'
    return window.localStorage.getItem(FILTER_KEY) === 'mine' ? 'mine' : 'all'
  })

  function setFilter(value: ViewFilter) {
    filter.value = value
    if (typeof window !== 'undefined') window.localStorage.setItem(FILTER_KEY, value)
  }

  watch(memberId, (value) => {
    if (!value) setFilter('all')
  })

  return { filter, setFilter }
}

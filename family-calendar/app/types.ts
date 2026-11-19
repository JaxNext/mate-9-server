export interface Member {
  id: number
  name: string
  color: string
}

export interface Tag {
  id: number
  name: string
  color: string
}

export interface TagWithCount extends Tag {
  count: number
}

export interface CalendarItem {
  eventId: number
  date: string
  state: 'done' | 'skipped' | null
  title: string
  note: string | null
  allDay: boolean
  startTime: string | null
  members: Member[]
  freq: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  startDate: string
  endDate: string | null
}

export interface EventDetail {
  id: number
  title: string
  note: string | null
  members: Member[]
  tags: Tag[]
  allDay: boolean
  startTime: string | null
  freq: CalendarItem['freq']
  interval: number
  startDate: string
  endDate: string | null
}

export interface EventListItem {
  id: number
  title: string
  allDay: boolean
  startTime: string | null
  members: Member[]
  tags: Tag[]
  freq: CalendarItem['freq']
  interval: number
  startDate: string
  endDate: string | null
  nextDate: string | null
  overdue: boolean
}

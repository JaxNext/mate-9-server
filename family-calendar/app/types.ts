export interface Member {
  id: number
  name: string
  color: string
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
  allDay: boolean
  startTime: string | null
  freq: CalendarItem['freq']
  interval: number
  startDate: string
  endDate: string | null
}

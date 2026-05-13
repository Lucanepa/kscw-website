import { fetchItems, fetchAllItems } from '../directus'
import { todayISO } from '../utils'

interface DirectusEvent {
  id: number; title: string; event_type: string; start_date: string;
  end_date: string | null; all_day: boolean; location: string | null; description: string | null;
  signup_url: string | null;
}

export interface CalendarEvent {
  id: string; title: string; eventType: string; startDate: string;
  endDate: string | null; allDay: boolean; location: string | null; description: string | null;
  signupUrl: string | null;
}

const EVENT_FIELDS = ['id', 'title', 'event_type', 'start_date', 'end_date', 'all_day', 'location', 'description', 'signup_url']

function mapEvent(e: DirectusEvent): CalendarEvent {
  return {
    id: String(e.id), title: e.title, eventType: e.event_type,
    startDate: e.start_date, endDate: e.end_date, allDay: e.all_day,
    location: e.location, description: e.description,
    signupUrl: e.signup_url,
  }
}

export async function getUpcomingEvents(limit = 3): Promise<CalendarEvent[]> {
  const items = await fetchItems<DirectusEvent>('events', {
    filter: { start_date: { _gte: todayISO() } },
    sort: ['start_date'],
    fields: EVENT_FIELDS,
    limit,
  })
  return items.map(mapEvent)
}

export async function getAllEvents(): Promise<CalendarEvent[]> {
  const items = await fetchAllItems<DirectusEvent>('events', {
    sort: ['start_date'],
    fields: EVENT_FIELDS,
  })
  return items.map(mapEvent)
}

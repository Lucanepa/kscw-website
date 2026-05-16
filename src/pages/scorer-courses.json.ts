import { getUpcomingScorerCourses } from '../data/scorer-courses';

export function GET() {
  const courses = getUpcomingScorerCourses();
  return new Response(JSON.stringify({ courses }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

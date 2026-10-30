import { notFound } from 'next/navigation'

/** Any URL no route claims renders the (app) not-found page inside the app shell. */
export default function UnknownRoute() {
  notFound()
}

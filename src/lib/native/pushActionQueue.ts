type PushAction = unknown
type Handler = (action: PushAction) => void

let handler: Handler | null = null
let pending: PushAction[] = []

/** Called by the always-on native listener. A tap that lands before the router mounts waits here instead of being dropped. */
export function enqueuePushAction(action: PushAction): void {
  if (handler) handler(action)
  else pending.push(action)
}

/** The router subscribes once it can navigate; anything queued meanwhile is replayed immediately. */
export function subscribePushActions(next: Handler): () => void {
  handler = next
  const queued = pending
  pending = []
  for (const a of queued) next(a)
  return () => { if (handler === next) handler = null }
}

export function __resetPushActionQueue(): void {
  handler = null
  pending = []
}

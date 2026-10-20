export interface AnalyticsReport {
  seconds: number
  sessions: number
  paths: Record<string, number>
}

interface Options {
  /** Sends one report; resolves true when it was stored. A report that fails is kept and retried with the next one. */
  send: (report: AnalyticsReport) => Promise<boolean>
  now?: () => number
  /** Longest stretch counted between two checks, so a sleeping device does not log hours of "activity". */
  maxStretchSeconds?: number
}

const MAX_PATHS = 30
const MAX_PATH_LENGTH = 80

/**
 * Collects visible time, session starts and page visits in memory and reports them as one small batch.
 * Replaces one network request per heartbeat with one per few minutes.
 */
export function createAnalyticsBuffer({ send, now = Date.now, maxStretchSeconds = 300 }: Options) {
  let seconds = 0
  let sessions = 0
  let paths: Record<string, number> = {}
  let visibleSince: number | null = null

  const accrue = () => {
    if (visibleSince === null) return
    const t = now()
    seconds += Math.min((t - visibleSince) / 1000, maxStretchSeconds)
    visibleSince = t
  }

  const addPaths = (into: Record<string, number>, from: Record<string, number>) => {
    for (const [p, n] of Object.entries(from)) {
      if (p in into || Object.keys(into).length < MAX_PATHS) into[p] = (into[p] ?? 0) + n
    }
  }

  return {
    startSession() {
      sessions += 1
    },
    visit(path: string) {
      addPaths(paths, { [path.slice(0, MAX_PATH_LENGTH)]: 1 })
    },
    setVisible(visible: boolean) {
      if (visible) visibleSince ??= now()
      else {
        accrue()
        visibleSince = null
      }
    },
    async flush(): Promise<void> {
      accrue()
      const report: AnalyticsReport = { seconds: Math.round(seconds), sessions, paths }
      if (report.seconds === 0 && report.sessions === 0 && Object.keys(report.paths).length === 0) return
      seconds = 0
      sessions = 0
      paths = {}
      let ok = false
      try {
        ok = await send(report)
      } catch {
        ok = false
      }
      if (!ok) {
        seconds += report.seconds
        sessions += report.sessions
        addPaths(paths, report.paths)
      }
    },
  }
}

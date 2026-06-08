'use client'

import { useCallback, useState } from 'react'
import type {
  AdminAnalyticsSnapshot,
  AdminConfig,
  AdminSurveyRow,
  AdminUserRow,
  SmsErrorRow,
  SmsTemplateRow,
} from '@/types/admin'

export function useAdminPanel() {
  const [pin, setPin] = useState('')
  const [sessionPin, setSessionPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [rateLimitingEnabled, setRateLimitingEnabled] = useState(false)
  const [rateLimitMax, setRateLimitMax] = useState(15)
  const [rateLimitWindowSec, setRateLimitWindowSec] = useState(60)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const [platformMessage, setPlatformMessage] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analytics, setAnalytics] = useState<AdminAnalyticsSnapshot | null>(null)
  const [surveyLoading, setSurveyLoading] = useState(false)
  const [surveyRows, setSurveyRows] = useState<AdminSurveyRow[]>([])
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplateRow[]>([])
  const [smsTemplatesLoading, setSmsTemplatesLoading] = useState(false)
  const [smsErrors, setSmsErrors] = useState<SmsErrorRow[]>([])
  const [smsErrorsLoading, setSmsErrorsLoading] = useState(false)
  const [smsErrorsCursor, setSmsErrorsCursor] = useState<string | null>(null)
  const [surveyEditId, setSurveyEditId] = useState<string | null>(null)
  const [surveyJson, setSurveyJson] = useState('')
  const [surveyBusy, setSurveyBusy] = useState(false)

  const handleLogin = useCallback(async () => {
    if (!pin.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Authentication failed')
        return
      }

      setAuthenticated(true)
      setSessionPin(pin.trim())
      setConfig(data.config)
      const rt = data.config?.ai?.runtime?.stored
      if (rt) {
        setRateLimitingEnabled(rt.rateLimitingEnabled)
        setRateLimitMax(rt.rateLimitMaxRequests)
        setRateLimitWindowSec(Math.round(rt.rateLimitWindowMs / 1000))
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [pin])

  const lock = useCallback(() => {
    setAuthenticated(false)
    setConfig(null)
    setPin('')
    setSessionPin('')
    setSaveMessage('')
  }, [])

  const saveAiRuntime = useCallback(async () => {
    const maxReq = Number(rateLimitMax)
    const winSec = Number(rateLimitWindowSec)
    if (rateLimitingEnabled) {
      if (!Number.isFinite(maxReq) || maxReq < 1 || !Number.isFinite(winSec) || winSec < 1) {
        setSaveMessage('When throttling is on, enter valid limits (min 1).')
        return
      }
    }
    setSaveLoading(true)
    setSaveMessage('')
    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: sessionPin,
          aiRuntime: {
            rateLimitingEnabled,
            rateLimitMaxRequests: Number.isFinite(maxReq) && maxReq >= 1 ? maxReq : 15,
            rateLimitWindowMs: Math.min(
              3_600_000,
              Math.max(1000, (Number.isFinite(winSec) && winSec >= 1 ? winSec : 60) * 1000)
            ),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveMessage(data.error || 'Save failed')
        return
      }
      setConfig(data.config)
      setSaveMessage('Saved.')
      const st = data.config?.ai?.runtime?.stored
      if (st) {
        setRateLimitingEnabled(st.rateLimitingEnabled)
        setRateLimitMax(st.rateLimitMaxRequests)
        setRateLimitWindowSec(Math.round(st.rateLimitWindowMs / 1000))
      }
    } catch {
      setSaveMessage('Network error')
    } finally {
      setSaveLoading(false)
    }
  }, [rateLimitingEnabled, rateLimitMax, rateLimitWindowSec, sessionPin])

  const loadUsers = useCallback(async () => {
    setPlatformMessage('')
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, perPage: 200, page: 1 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPlatformMessage(data.error || 'Failed to load users')
        return
      }
      setUsers(data.users ?? [])
      setPlatformMessage(`Loaded ${data.users?.length ?? 0} users.`)
    } catch {
      setPlatformMessage('Network error')
    } finally {
      setUsersLoading(false)
    }
  }, [sessionPin])

  const loadAnalytics = useCallback(async () => {
    setPlatformMessage('')
    setAnalyticsLoading(true)
    try {
      const res = await fetch('/api/admin/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, days: 7 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPlatformMessage(data.error || 'Failed to load analytics')
        return
      }
      setAnalytics(data)
      setPlatformMessage(`Loaded ${data.eventCount ?? 0} events since ${data.since ?? '—'}.`)
    } catch {
      setPlatformMessage('Network error')
    } finally {
      setAnalyticsLoading(false)
    }
  }, [sessionPin])

  const loadSurveyRows = useCallback(async () => {
    setPlatformMessage('')
    setSurveyLoading(true)
    try {
      const res = await fetch('/api/admin/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'list' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPlatformMessage(data.error || 'Failed to load survey')
        return
      }
      const rows = (data.rows ?? []) as AdminSurveyRow[]
      setSurveyRows(rows)
      const first = rows[0]
      if (first) {
        setSurveyEditId(first.id)
        setSurveyJson(JSON.stringify(first.config ?? { steps: [] }, null, 2))
      } else {
        setSurveyEditId(null)
        setSurveyJson(JSON.stringify({ steps: [] }, null, 2))
      }
      setPlatformMessage(`Loaded ${rows.length} survey row(s).`)
    } catch {
      setPlatformMessage('Network error')
    } finally {
      setSurveyLoading(false)
    }
  }, [sessionPin])

  const saveSurveyConfig = useCallback(async () => {
    setPlatformMessage('')
    let parsed: unknown
    try {
      parsed = JSON.parse(surveyJson)
    } catch {
      setPlatformMessage('Invalid JSON')
      return
    }
    setSurveyBusy(true)
    try {
      const res = await fetch('/api/admin/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'update', id: surveyEditId, config: parsed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPlatformMessage(data.error || 'Save failed')
        return
      }
      setPlatformMessage('Survey config saved.')
      setSurveyRows((prev) => prev.map((r) => (r.id === surveyEditId ? { ...r, config: parsed } : r)))
    } catch {
      setPlatformMessage('Network error')
    } finally {
      setSurveyBusy(false)
    }
  }, [sessionPin, surveyEditId, surveyJson])

  const publishSurvey = useCallback(async () => {
    setPlatformMessage('')
    setSurveyBusy(true)
    try {
      const res = await fetch('/api/admin/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'publish', id: surveyEditId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPlatformMessage(data.error || 'Publish failed')
        return
      }
      setPlatformMessage('Published selected survey version.')
      const res2 = await fetch('/api/admin/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'list' }),
      })
      const data2 = await res2.json()
      if (res2.ok) setSurveyRows(data2.rows ?? [])
    } catch {
      setPlatformMessage('Network error')
    } finally {
      setSurveyBusy(false)
    }
  }, [sessionPin, surveyEditId])

  const loadSmsTemplates = useCallback(async () => {
    setSmsTemplatesLoading(true)
    try {
      const res = await fetch('/api/admin/sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'list' }),
      })
      const data = await res.json()
      if (!res.ok) { setPlatformMessage(data.error || 'Failed to load templates'); return }
      setSmsTemplates(data.templates ?? [])
    } catch {
      setPlatformMessage('Network error')
    } finally {
      setSmsTemplatesLoading(false)
    }
  }, [sessionPin])

  const updateSmsTemplate = useCallback(async (
    id: string,
    patch: Partial<Pick<SmsTemplateRow, 'ai_enabled' | 'regex_pattern'>>,
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'update', id, patch }),
      })
      const data = await res.json()
      if (res.ok && data.template) {
        setSmsTemplates((prev) => prev.map((t) => (t.id === id ? (data.template as SmsTemplateRow) : t)))
        return true
      }
      setPlatformMessage(data.error || 'Update failed')
      return false
    } catch {
      setPlatformMessage('Network error')
      return false
    }
  }, [sessionPin])

  const deleteSmsTemplate = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch('/api/admin/sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'delete', id }),
      })
      if (res.ok) {
        setSmsTemplates((prev) => prev.filter((t) => t.id !== id))
      } else {
        const data = await res.json()
        setPlatformMessage(data.error || 'Delete failed')
      }
    } catch {
      setPlatformMessage('Network error')
    }
  }, [sessionPin])

  const bulkToggleSmsTemplates = useCallback(async (enabled: boolean): Promise<void> => {
    try {
      const res = await fetch('/api/admin/sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'bulk_toggle', patch: { ai_enabled: enabled } }),
      })
      if (res.ok) {
        // Re-fetch so local state reflects the server state
        void loadSmsTemplates()
      } else {
        const data = await res.json()
        setPlatformMessage(data.error || 'Bulk toggle failed')
      }
    } catch {
      setPlatformMessage('Network error')
    }
  }, [sessionPin, loadSmsTemplates])

  const loadSmsErrors = useCallback(async (append = false) => {
    setSmsErrorsLoading(true)
    try {
      const cursor = append ? smsErrorsCursor : undefined
      const res = await fetch('/api/admin/sms-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: sessionPin, op: 'list', cursor, limit: 50 }),
      })
      const data = await res.json()
      if (!res.ok) { setPlatformMessage(data.error || 'Failed'); return }
      setSmsErrors((prev) => append ? [...prev, ...(data.errors ?? [])] : (data.errors ?? []))
      setSmsErrorsCursor(data.nextCursor ?? null)
    } catch { setPlatformMessage('Network error') }
    finally { setSmsErrorsLoading(false) }
  }, [sessionPin, smsErrorsCursor])

  const api = {
    pin,
    setPin,
    sessionPin,
    authenticated,
    config,
    error,
    loading,
    handleLogin,
    lock,
    rateLimitingEnabled,
    setRateLimitingEnabled,
    rateLimitMax,
    setRateLimitMax,
    rateLimitWindowSec,
    setRateLimitWindowSec,
    saveLoading,
    saveMessage,
    saveAiRuntime,
    platformMessage,
    users,
    usersLoading,
    loadUsers,
    analytics,
    analyticsLoading,
    loadAnalytics,
    surveyRows,
    surveyEditId,
    setSurveyEditId,
    surveyJson,
    setSurveyJson,
    surveyLoading,
    surveyBusy,
    loadSurveyRows,
    saveSurveyConfig,
    publishSurvey,
    smsTemplates,
    smsTemplatesLoading,
    loadSmsTemplates,
    updateSmsTemplate,
    deleteSmsTemplate,
    bulkToggleSmsTemplates,
    smsErrors,
    smsErrorsLoading,
    smsErrorsCursor,
    loadSmsErrors,
  }
  return api
}

export type AdminPanelModel = ReturnType<typeof useAdminPanel>

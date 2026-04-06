import { buildBudgetInviteHtml } from '@/lib/email/budgetInviteTemplate'

export interface SendBudgetInviteEmailArgs {
  to: string
  inviterName: string
  planName: string
  permissionLabel: string
  joinUrl: string
}

/**
 * Sends invite email via Resend when `RESEND_API_KEY` is set.
 * Returns `{ sent: false }` when not configured (caller may still succeed).
 */
export async function sendBudgetInviteEmail(args: SendBudgetInviteEmailArgs): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL || 'noreply@buddget.online'
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://buddget.online'

  if (!key) {
    console.warn('[budget invite] RESEND_API_KEY not set; email skipped')
    return { sent: false }
  }

  const html = buildBudgetInviteHtml({
    inviterName: args.inviterName,
    planName: args.planName,
    permissionLabel: args.permissionLabel,
    joinUrl: args.joinUrl,
    appOrigin,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Buddget <${from}>`,
      to: [args.to],
      subject: `${args.inviterName} invited you to a shared budget on Buddget`,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[budget invite] Resend error', res.status, text)
    return { sent: false }
  }

  return { sent: true }
}

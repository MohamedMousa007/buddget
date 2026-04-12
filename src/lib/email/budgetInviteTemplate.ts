/**
 * Branded HTML for external budget invite emails (Resend or similar).
 * Matches Buddget dark theme + red “d” accent.
 */

export interface BudgetInviteTemplateArgs {
  inviterName: string
  planName: string
  permissionLabel: string
  joinUrl: string
  appOrigin: string
}

export function buildBudgetInviteHtml(args: BudgetInviteTemplateArgs): string {
  const { inviterName, planName, permissionLabel, joinUrl, appOrigin } = args
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Buddget invitation</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0d12;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#111118;border:1px solid #2A2A38;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px 8px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                Bud<span style="color:#E50914;">d</span>get
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#e0e0eb;">
                <strong style="color:#ffffff;">${escapeHtml(inviterName)}</strong> invited you to join their budget plan
                <strong style="color:#ffffff;">${escapeHtml(planName)}</strong> on Buddget.
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#A0A0B8;">
                You’ll be able to ${escapeHtml(permissionLabel)} this budget.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td style="border-radius:12px;background:#E50914;">
                    <a href="${escapeAttr(joinUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Join Buddget
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6B6B7A;">
                If the button doesn’t work, copy this link into your browser:<br />
                <span style="word-break:break-all;color:#A0A0B8;">${escapeHtml(joinUrl)}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;border-top:1px solid #2A2A38;">
              <p style="margin:0;font-size:11px;color:#6B6B7A;text-align:center;">
                Sent from Buddget · ${escapeHtml(appOrigin)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

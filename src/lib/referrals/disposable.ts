// ponytail: a fixed list of the common throwaway-mail services; move it to a table when staff need to edit it.
const DISPOSABLE = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com', '33mail.com', 'anonaddy.me', 'burnermail.io', 'byom.de', 'dispostable.com',
  'dropmail.me', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net', 'getairmail.com', 'getnada.com', 'guerrillamail.biz', 'guerrillamail.com',
  'guerrillamail.de', 'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com', 'harakirimail.com', 'inboxbear.com',
  'inboxkitten.com', 'mail.tm', 'mailcatch.com', 'maildrop.cc', 'mailinator.com', 'mailinator.net', 'mailnesia.com', 'mailpoof.com', 'mailsac.com',
  'mintemail.com', 'moakt.com', 'mohmal.com', 'mytemp.email', 'nada.email', 'sharklasers.com', 'spam4.me', 'spamgourmet.com', 'temp-mail.io',
  'temp-mail.org', 'tempail.com', 'tempinbox.com', 'tempmail.com', 'tempmail.dev', 'tempmail.net', 'tempmailo.com', 'tempr.email', 'throwawaymail.com',
  'trashmail.com', 'trashmail.de', 'trashmail.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net', 'emailfake.com', 'luxusmail.org', 'tmail.ws', 'tmpmail.org',
])

/** True for an address at a known throwaway-mail domain, or any subdomain of one. */
export function isDisposableEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).trim().toLowerCase()
  const parts = domain.split('.')
  return parts.some((_, i) => DISPOSABLE.has(parts.slice(i).join('.')))
}

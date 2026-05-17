'use client'

/**
 * Read-only list of Egyptian banks and services supported by the SMS parser.
 * Displayed at the bottom of the SMS tracking settings section.
 */

const SUPPORTED = [
  { name: 'CIB Egypt',                  sender: 'CIB',           badge: '🏦', types: 'Purchase · Online · Transfer' },
  { name: 'Banque Misr',                sender: 'Banque-Misr',   badge: '🏦', types: 'Purchase · ATM · Transfer' },
  { name: 'National Bank of Egypt',     sender: 'NBE',           badge: '🏦', types: 'Purchase · ATM · Transfer' },
  { name: 'QNB Alahli',                 sender: 'QNB',           badge: '🏦', types: 'Purchase · Transfer' },
  { name: 'HSBC Egypt',                 sender: 'HSBC',          badge: '🏦', types: 'Purchase · Online' },
  { name: 'Alex Bank',                  sender: 'ALEXBANK',      badge: '🏦', types: 'Purchase' },
  { name: 'Standard Chartered Egypt',   sender: 'SCB',           badge: '🏦', types: 'Purchase' },
  { name: 'Fawry',                      sender: 'Fawry',         badge: '🧾', types: 'Bill Payment' },
  { name: 'InstaPay',                   sender: 'InstaPay',      badge: '⚡', types: 'Send · Receive' },
  { name: 'Vodafone Cash',              sender: 'VF-Cash',       badge: '📱', types: 'Send · Receive · Pay' },
  { name: 'Orange Money',               sender: 'Orange-Money',  badge: '📱', types: 'Send · Receive' },
  { name: 'e& Money',                   sender: 'Etisalat-Cash', badge: '📱', types: 'Send · Pay' },
  { name: 'ValU',                       sender: 'ValU',          badge: '📅', types: 'Instalment' },
  { name: 'Sympl',                      sender: 'Sympl',         badge: '📅', types: 'Instalment' },
  { name: 'Amazon Egypt',               sender: 'Amazon.eg',     badge: '🌐', types: 'Online Charge' },
  { name: 'Uber Egypt',                 sender: 'Uber',          badge: '🚗', types: 'Online Charge' },
]

export function SmsSupportedBanksList() {
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {SUPPORTED.map((b) => (
        <li
          key={b.sender}
          className="flex items-start gap-2 rounded-lg bg-[var(--color-brand-elevated)] px-3 py-2"
        >
          <span className="text-base leading-none mt-0.5">{b.badge}</span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-brand-text-primary)] truncate">{b.name}</p>
            <p className="text-[10px] text-[var(--color-brand-text-muted)]">{b.types}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

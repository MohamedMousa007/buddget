'use client'

import { useState } from 'react'
import { Gem, Bitcoin, TrendingUp, Home } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { Switch } from '@/components/ui/switch'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { AssetFormSheet } from '@/components/features/savings-v3/AssetFormSheet'
import { PocketFormSheet } from '@/components/features/savings-v3/PocketFormSheet'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Card } from '@/components/ui/card'
import { BankAccountPicker } from '@/components/features/savings-v3/BankAccountPicker'
import { useSavingsV9Copy } from '@/lib/i18n/savingsV9Copy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { POCKET_KINDS, type PocketKind, type PocketKindDef } from '@/lib/savings/pocketKinds'
import { micro as label } from '@/lib/ui/microLabelStyle'
import type { Currency, InvestmentAssetType, PaymentMethod } from '@/lib/store/types'

type Tab = 'pocket' | 'investment'

const KINDS: PocketKind[] = ['bank', 'cash', 'certificate', 'wallet']

const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`

const ASSETS: Array<{ key: InvestmentAssetType; icon: React.ReactNode; color: string; name: 'goldName' | 'cryptoName' | 'stockName' | 'propertyName'; sub: 'goldSub' | 'cryptoSub' | 'stockSub' | 'propertySub' }> = [
  { key: 'gold', icon: <Gem size={22} />, color: 'var(--color-brand-gold)', name: 'goldName', sub: 'goldSub' },
  { key: 'crypto', icon: <Bitcoin size={22} />, color: 'var(--color-cat-6)', name: 'cryptoName', sub: 'cryptoSub' },
  { key: 'stock', icon: <TrendingUp size={22} />, color: 'var(--color-cat-2)', name: 'stockName', sub: 'stockSub' },
  { key: 'property', icon: <Home size={22} />, color: 'var(--color-cat-5)', name: 'propertyName', sub: 'propertySub' },
]

export interface AddHoldingSheetProps {
  open: boolean
  onClose: () => void
  initialTab?: Tab
  /** Opens straight into this asset's form (e.g. a per-type Add button). */
  presetAssetType?: InvestmentAssetType | null
  /** Pockets only: hides the Investment tab (opened from a money sheet's "Add pocket"). */
  pocketOnly?: boolean
  /** Called with the new pocket before the flow closes. */
  onPocketCreated?: (id: string, currency: Currency) => void
}

export function AddHoldingSheet({ open, ...rest }: AddHoldingSheetProps) {
  if (!open) return null
  return <AddHoldingBody {...rest} />
}

function AddHoldingBody({ onClose, initialTab, presetAssetType, pocketOnly, onPocketCreated }: Omit<AddHoldingSheetProps, 'open'>) {
  const t = useT().addHolding
  const sf = useT().savingsForms
  const v9 = useSavingsV9Copy()
  const wealthGoldStrip = useFinanceStore((s) => s.settings.wealthGoldStrip)
  const updateSettings = useFinanceStore((s) => s.updateSettings)

  const [tab, setTab] = useState<Tab>(pocketOnly ? 'pocket' : presetAssetType ? 'investment' : (initialTab ?? 'pocket'))
  const [kind, setKind] = useState<PocketKind | null>('bank')
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [formDef, setFormDef] = useState<{ def: PocketKindDef; method: PaymentMethod | null } | null>(null)
  const [asset, setAsset] = useState<InvestmentAssetType | null>(presetAssetType ?? null)

  const pickKind = (k: PocketKind) => { setKind(k); setMethod(null) }
  const pickMethod = (pm: PaymentMethod) => { setMethod(pm); setKind(null) }
  const proceed = () => {
    if (method) setFormDef({ def: method.type === 'wallet' ? POCKET_KINDS.wallet : method.type === 'cash' ? POCKET_KINDS.cash : POCKET_KINDS.bank, method })
    else if (kind) setFormDef({ def: POCKET_KINDS[kind], method: null })
  }

  // Chooser and forms are sibling ModalShells so each registers its own back guard: hardware back
  // peels the form first, then the chooser. The chooser steps aside while a form is up, so the page is dimmed once
  // (one scrim, as the approved sheets show), and comes back with its choice when the form closes.
  return (
    <>
      <ModalShell open={!formDef && !asset} onBackdropClick={onClose} scrollChild>
        <div className="flex min-h-0 flex-1 flex-col">
          <V3SheetHeader onClose={onClose}>
            <V3SheetHeader.Title>{tab === 'pocket' ? v9.page.addPocket : t.title}</V3SheetHeader.Title>
            <V3SheetHeader.Subtitle>{tab === 'pocket' ? t.subtitlePocket : t.subtitleInvestment}</V3SheetHeader.Subtitle>
          </V3SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-3">
            {pocketOnly ? null : (
              <SegmentedControl<Tab>
                ariaLabel={t.tabsAria}
                value={tab}
                onChange={setTab}
                options={[{ value: 'pocket', label: t.tabPocket }, { value: 'investment', label: t.tabInvestment }]}
              />
            )}

            {tab === 'pocket' ? (
              <>
                <div>
                  <p style={label}>{v9.picker.title}</p>
                  <Card padding="none" className="mt-2 overflow-hidden">
                    <BankAccountPicker value={method} onChange={pickMethod} />
                  </Card>
                  <p className="mt-2 px-1 text-xs leading-relaxed text-[var(--color-brand-text-muted)]">{v9.picker.groupNote}</p>
                </div>

                <div>
                  <p style={label}>{t.startFromKind}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={t.startFromKind}>
                    {KINDS.map((k) => {
                      const def = POCKET_KINDS[k]
                      return (
                        <SelectableCard key={k} layout="stack" selected={kind === k} onClick={() => pickKind(k)} className="p-3.5">
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: tint(def.color, 16), color: def.color }}>
                            <SavingsAccountIcon account={{ type: def.savingsType, icon: def.icon }} className="h-5 w-5" />
                          </span>
                          <p className="mt-1 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{sf.pocketKinds[k].label}</p>
                          <p className="text-xs text-[var(--color-brand-text-muted)]">{sf.pocketKinds[k].sub}</p>
                        </SelectableCard>
                      )
                    })}
                  </div>
                </div>

                <Button size="cta-block" onClick={proceed} disabled={!kind && !method} className="font-semibold">
                  {v9.page.addPocket}
                </Button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  {ASSETS.map((a) => (
                    <SelectableCard key={a.key} as="action" layout="stack" onClick={() => setAsset(a.key)} className="p-3.5">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: tint(a.color, 16), color: a.color }}>{a.icon}</span>
                      <p className="mt-1 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{t[a.name]}</p>
                      <p className="text-xs text-[var(--color-brand-text-muted)]">{t[a.sub]}</p>
                    </SelectableCard>
                  ))}
                </div>

                <div className="flex min-h-[60px] items-center justify-between gap-3 rounded-2xl bg-[var(--color-brand-elevated)] px-4 py-3">
                  <div className="min-w-0">
                    <p id="gold-strip-label" className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{t.goldStripTitle}</p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">{t.goldStripSub}</p>
                  </div>
                  <Switch
                    size="touch"
                    aria-labelledby="gold-strip-label"
                    checked={wealthGoldStrip !== 'hidden'}
                    onCheckedChange={(on) => updateSettings({ wealthGoldStrip: on ? 'collapsed' : 'hidden' })}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </ModalShell>

      {formDef && (
        <PocketFormSheet
          open
          def={formDef.def}
          linkedMethod={formDef.method}
          onClose={() => setFormDef(null)}
          onCreated={onPocketCreated}
          onDone={() => { setFormDef(null); onClose() }}
        />
      )}
      {asset && (
        <AssetFormSheet
          open
          type={asset}
          onClose={() => (presetAssetType ? onClose() : setAsset(null))}
          onDone={() => { setAsset(null); onClose() }}
        />
      )}
    </>
  )
}

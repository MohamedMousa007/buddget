'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AddSubscriptionSheet } from '@/components/features/subscriptions/AddSubscriptionSheet'
import { CancelSubscriptionSheet } from '@/components/features/subscriptions/CancelSubscriptionSheet'
import { HomeNudge } from '@/components/features/subscriptions/HomeNudge'
import { FoundSubscriptionsSheet } from '@/components/features/subscriptions/FoundSubscriptionsSheet'
import { SubscriptionsFoundRow } from '@/components/features/subscriptions/SubscriptionsFoundRow'
import { SubscriptionDetailSheet } from '@/components/features/subscriptions/SubscriptionDetailSheet'
import { AddSubscriptionLink, SubscriptionGroups } from '@/components/features/subscriptions/SubscriptionGroups'
import { SubscriptionsEmpty } from '@/components/features/subscriptions/SubscriptionsEmpty'
import { SubscriptionsHero } from '@/components/features/subscriptions/SubscriptionsHero'
import { SubscriptionsRail } from '@/components/features/subscriptions/SubscriptionsRail'
import { PageGrid } from '@/components/layout/PageGrid'
import { PageHero } from '@/components/layout/PageHero'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useSubscriptionsHome } from '@/hooks/useSubscriptionsHome'
import { catalogRegionOf } from '@/lib/subscriptions/catalogDisplay'
import { useT } from '@/lib/i18n'
import { navigate } from '@/lib/navigation/navigate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { Subscription } from '@/lib/store/types'
import type { Segment } from '@/lib/subscriptions/subscriptionRows'

export default function SubscriptionsPage() {
  const t = useT()
  const ui = t.subscriptions.ui
  const { dataReady, profile, smsEnabled, subscriptions } = useFinanceStore(
    useShallow((s) => ({
      dataReady: s.dataReady,
      profile: s.profile,
      smsEnabled: s.settings.smsTrackingEnabled,
      subscriptions: s.subscriptions,
    })),
  )
  const { addOpen, setAddOpen, reviewOpen, setReviewOpen } = useSettingsStore(
    useShallow((s) => ({
      addOpen: s.subscriptionAddOpen,
      setAddOpen: s.setSubscriptionAddOpen,
      reviewOpen: s.subscriptionReviewOpen,
      setReviewOpen: s.setSubscriptionReviewOpen,
    })),
  )
  const [segment, setSegment] = useState<Segment>('upcoming')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [seedBrandKey, setSeedBrandKey] = useState<string | null>(null)
  const [instance, setInstance] = useState(0)
  const home = useSubscriptionsHome(segment)

  const openAdd = (brandKey: string | null = null) => {
    setEditing(null)
    setSeedBrandKey(brandKey)
    setInstance((n) => n + 1)
    setAddOpen(true)
  }
  const closeAdd = () => {
    setAddOpen(false)
    setEditing(null)
    setSeedBrandKey(null)
  }
  const openEdit = (id: string) => {
    setDetailId(null)
    setEditing(subscriptions.find((s) => s.id === id) ?? null)
    setInstance((n) => n + 1)
    setAddOpen(true)
  }
  const openCancel = (id: string) => {
    setDetailId(null)
    setCancelId(id)
  }
  const scan = () => (smsEnabled ? setReviewOpen(true) : navigate('/settings/sms'))

  const empty = dataReady && subscriptions.length === 0
  const { groups } = home.lists

  return (
    <div>
      {empty ? null : (
        <PageHero inset>
          <SubscriptionsHero hero={dataReady ? home.hero : null} base={home.base} loading={!dataReady} />
        </PageHero>
      )}
      <PageGrid
        stack
        wide={empty}
        primary={
          <div className="flex min-w-0 flex-col gap-3.5 px-4 pb-4 pt-4 lg:px-0 lg:pb-0 lg:pt-0">
            <SubscriptionsFoundRow />
            {empty ? (
              <SubscriptionsEmpty
                region={catalogRegionOf(profile)}
                onPickBrand={(key) => openAdd(key)}
                onAdd={() => openAdd()}
                onScan={scan}
              />
            ) : (
              <>
                <SegmentedControl<Segment>
                  ariaLabel={ui.segments.label}
                  value={segment}
                  onChange={setSegment}
                  options={[
                    { value: 'upcoming', label: ui.segments.upcoming },
                    { value: 'all', label: ui.segments.all },
                    { value: 'ended', label: ui.segments.ended },
                  ]}
                />
                {!dataReady ? (
                  <SkeletonList />
                ) : (
                  <>
                    {segment === 'upcoming' && home.nudge ? <HomeNudge nudge={home.nudge} onOpen={setDetailId} /> : null}
                    {groups.length === 0 ? (
                      <div className="flex flex-col items-center gap-1 py-6">
                        <p className="text-center text-sm text-[var(--color-brand-text-secondary)]">{ui.emptyTab}</p>
                        <AddSubscriptionLink onAdd={() => openAdd()} />
                      </div>
                    ) : (
                      <SubscriptionGroups groups={groups} onOpen={setDetailId} onAdd={() => openAdd()} />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        }
        secondary={empty ? undefined : <SubscriptionsRail strip={home.strip} insights={home.insights} />}
      />

      <AddSubscriptionSheet open={addOpen} onClose={closeAdd} editing={editing} seedBrandKey={seedBrandKey} instanceKey={instance} />
      <SubscriptionDetailSheet key={detailId ?? 'none'} subId={detailId} onClose={() => setDetailId(null)} onEdit={openEdit} onCancel={openCancel} />
      <CancelSubscriptionSheet key={`c-${cancelId ?? 'none'}`} subId={cancelId} onClose={() => setCancelId(null)} />
      <FoundSubscriptionsSheet open={reviewOpen} onClose={() => setReviewOpen(false)} />
    </div>
  )
}

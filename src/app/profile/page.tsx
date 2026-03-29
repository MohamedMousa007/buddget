'use client'

import { useEffect, useMemo, useState } from 'react'
import { User, Pencil } from 'lucide-react'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { AvatarPickerModal } from '@/components/profile/AvatarPickerModal'

interface FieldRowProps {
  label: string
  value: string
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="border-b border-[#2A2A38] pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <p className="text-xs uppercase tracking-wider text-[#5A5A72]">{label}</p>
      <p className="text-white text-sm mt-0.5">{value || '—'}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const store = useFinanceStore()

  const supabaseConfigured = useMemo(
    () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    []
  )

  useEffect(() => {
    if (user?.email) {
      useFinanceStore.getState().updateProfile({ email: user.email })
    }
  }, [user?.email])

  const [editMode, setEditMode] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', city: '' })

  const avatarSrc = resolveProfileAvatarSrc(store.profile)
  const displayName = store.profile.name || 'User'
  const displayEmail = user?.email || store.profile.email || ''

  const enterEditMode = () => {
    setForm({
      name: store.profile.name,
      email: store.profile.email || user?.email || '',
      phone: store.profile.phone || '',
      country: store.profile.country || '',
      city: store.profile.city || '',
    })
    setEditMode(true)
  }

  const discard = () => setEditMode(false)

  const save = () => {
    store.updateProfile({
      name: form.name,
      phone: form.phone,
      country: form.country,
      city: form.city,
    })
    if (!user) store.updateProfile({ email: form.email })
    setEditMode(false)
  }

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const inputClass =
    'bg-[#1A1A24] border border-[#2A2A38] focus:border-[#E50914] rounded-xl px-3 py-2 text-white text-sm w-full outline-none transition-colors'

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-[var(--color-brand-red)]" />
            My Profile
          </h1>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto">
        <div className="bg-[#111118] border border-[#2A2A38] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Left column — avatar */}
            <div className="w-32 shrink-0 flex flex-col items-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-[#2A2A38] bg-[var(--color-brand-elevated)] flex items-center justify-center">
                  {avatarSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt="" className="w-full h-full object-cover" width={96} height={96} />
                  ) : (
                    <User className="w-10 h-10 text-[var(--color-brand-text-secondary)]" />
                  )}
                </div>
                {editMode && (
                  <button
                    type="button"
                    onClick={() => setAvatarModalOpen(true)}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#E50914] flex items-center justify-center cursor-pointer hover:bg-[var(--color-brand-red-hover)] transition-colors"
                    aria-label="Change avatar"
                  >
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
              {!editMode && (
                <button
                  type="button"
                  onClick={enterEditMode}
                  className="text-sm text-[#A0A0B8] hover:text-white border border-[#2A2A38] rounded-lg px-3 py-1.5 mt-3 w-full text-center transition-colors"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {/* Right column — details */}
            <div className="flex-1 min-w-0">
              {editMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">Your name</label>
                    <input
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className={inputClass}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">
                      Email address {user ? '(from account)' : ''}
                    </label>
                    <input
                      value={form.email}
                      onChange={(e) => { if (!user) updateField('email', e.target.value) }}
                      readOnly={!!user}
                      className={`${inputClass} ${user ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">Phone number</label>
                    <input
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className={inputClass}
                      placeholder="+971 50 000 0000"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">Country</label>
                    <input
                      value={form.country}
                      onChange={(e) => updateField('country', e.target.value)}
                      className={inputClass}
                      placeholder="Country"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A72] block mb-1">City</label>
                    <input
                      value={form.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      className={inputClass}
                      placeholder="Dubai"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <FieldRow label="Your name" value={displayName} />
                  <FieldRow label="Email address" value={displayEmail} />
                  <FieldRow label="Phone number" value={store.profile.phone || ''} />
                  <FieldRow label="Country" value={store.profile.country || ''} />
                  <FieldRow label="City" value={store.profile.city || ''} />
                </>
              )}
            </div>
          </div>

          {editMode && (
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2A2A38]">
              <button
                type="button"
                onClick={discard}
                className="px-4 py-2 rounded-xl border border-[#2A2A38] text-sm text-[#A0A0B8] hover:text-white hover:bg-[var(--color-brand-elevated)] transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                className="px-4 py-2 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              >
                Save changes
              </button>
            </div>
          )}
        </div>
      </div>

      <AvatarPickerModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        store={store}
      />
    </div>
  )
}

'use client'

import Image from 'next/image'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const GRID: { name: string; file: string }[] = [
  { name: 'Netflix', file: 'netflix' },
  { name: 'Spotify', file: 'spotify' },
  { name: 'Apple Music', file: 'apple_music' },
  { name: 'Disney+', file: 'disney_plus' },
  { name: 'YouTube Premium', file: 'youtube_premium' },
  { name: 'Apple TV+', file: 'apple_tv_plus' },
  { name: 'Anghami', file: 'anghami' },
  { name: 'Crunchyroll', file: 'crunchyroll' },
  { name: 'ChatGPT Plus', file: 'chatgpt_plus' },
  { name: 'Claude Pro', file: 'claude_pro' },
  { name: 'Cursor', file: 'cursor' },
  { name: 'Dropbox', file: 'dropbox' },
  { name: 'Audible', file: 'audible' },
  { name: 'Apple Fitness', file: 'apple_fitness' },
]

function iconSrc(file: string) {
  return `/subscription-icons/${file}.png`
}

export function StepSubscriptions({ draft, updateDraft }: OnboardingStepProps) {
  function rowFor(name: string) {
    return draft.subscriptions.find((s) => s.name === name)
  }

  function toggle(name: string, file: string) {
    const existing = rowFor(name)
    if (existing) {
      updateDraft({ subscriptions: draft.subscriptions.filter((s) => s.name !== name) })
      return
    }
    updateDraft({
      subscriptions: [...draft.subscriptions, { name, amount: 0, icon: iconSrc(file) }],
    })
  }

  function setAmount(name: string, amount: number) {
    updateDraft({
      subscriptions: draft.subscriptions.map((s) => (s.name === name ? { ...s, amount } : s)),
    })
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="grid grid-cols-4 md:grid-cols-5 gap-3">
        {GRID.map(({ name, file }) => {
          const selected = Boolean(rowFor(name))
          return (
            <div key={name} className="flex flex-col gap-1 items-center">
              <button
                type="button"
                onClick={() => toggle(name, file)}
                className={cn(
                  'w-20 h-20 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-colors',
                  selected ?
                    'border-[#E50914] bg-[#E50914]/10'
                  : 'border-[#2A2A38] bg-[#111118] hover:border-[#5A5A72]',
                )}
                aria-pressed={selected}
                aria-label={`Toggle ${name}`}
              >
                <Image src={iconSrc(file)} alt="" width={40} height={40} className="object-contain" />
                <span className="text-[10px] text-center text-white leading-tight px-0.5 line-clamp-2">
                  {name}
                </span>
              </button>
              {selected ? (
                <div className="w-full">
                  <label className="sr-only" htmlFor={`sub-amt-${file}`}>
                    {name} monthly amount
                  </label>
                  <div className="flex items-center gap-1 text-[10px] text-[#A0A0B8]">
                    <span className="whitespace-nowrap">{draft.baseCurrency}</span>
                    <Input
                      id={`sub-amt-${file}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={rowFor(name)?.amount || ''}
                      onChange={(e) => setAmount(name, parseFloat(e.target.value) || 0)}
                      className="h-8 px-1 text-xs bg-[#111118] border-[#2A2A38] text-white"
                    />
                    <span className="whitespace-nowrap">/mo</span>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

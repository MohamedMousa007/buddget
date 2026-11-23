'use client'

import { MessageCircle } from 'lucide-react'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { cn } from '@/lib/utils'
import s from './smsSetup.module.css'

/**
 * The branded lock-screen story (approved mockup sms-intro-b, B1): a bank SMS arrives, is read, and buddget's "Logged"
 * notification lands on top. Loops every 8 s; Reduce Motion shows the final frame. Android gets a punch-hole camera.
 */
export function SmsLockHero({ platform = 'ios' }: { platform?: 'ios' | 'android' }) {
  const c = useT().smsSetup
  const { locale } = useLocale()
  return (
    <div className={cn(s.illo, s.heroStage, 'relative flex min-h-0 flex-1 justify-center overflow-hidden pt-3')} aria-hidden>
      <div className={s.device}>
        <div className={s.wall}>
          <div className={cn(s.island, platform === 'android' && s.punchHole)} />
          <div className={s.battery} />
          <div className={s.lock}>
            <div className={s.date}>{formatLocalized(new Date(), 'EEEE d MMMM', locale)}</div>
            <div className={s.time}>9:41</div>
          </div>
          <div className={s.list} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className={cn(s.note, s.sms)}>
              <span className={cn(s.noteIcon, s.msgIcon)}><MessageCircle className="size-[17px]" fill="currentColor" strokeWidth={0} /></span>
              <div className={s.noteBody}>
                <div className={s.noteHead}>{c.heroBank}<span>{c.heroNow}</span></div>
                <p className={s.noteText}>
                  {c.heroSmsPre}<span dir="ltr" className={s.u}>EGP 45.00</span>{c.heroSmsMid}<span dir="ltr" className={s.u}>STARBUCKS</span>{c.heroSmsPost}
                </p>
              </div>
              <span className={s.scan} />
              <span className={s.ding} />
            </div>
            <div className={cn(s.note, s.bud)}>
              <img className={s.noteIcon} src="/icons/icon-192.png" alt="" />
              <div className={s.noteBody}>
                <div className={s.noteHead}>buddget<span>{c.heroNow}</span></div>
                <p className={cn(s.noteText, s.budText)}>
                  <b className={s.logged}>{c.heroLogged}</b> <span dir="ltr" className={s.amount}>EGP 45</span>{c.heroLoggedPost}
                </p>
                <div className={s.detail}>{c.heroLoggedDetail}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

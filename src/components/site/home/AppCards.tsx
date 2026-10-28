import type { ReactNode } from 'react'
import type { SiteLocale } from '@/lib/site/config'
import { nf } from './format'

/* Built replicas of the app's cards, drawn in the brand's colours. Demo data only. */

type IconName = 'food' | 'car' | 'heart' | 'home' | 'goal' | 'shield' | 'plane' | 'laptop' | 'bank' | 'cash' | 'wallet'

const ICON_PATHS: Record<IconName, ReactNode> = {
  food: <path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v6a2 2 0 0 1-2 2M17 3c-2 1.5-3 4-3 7h3v11" />,
  car: <><path d="M5 16V11l2-5h10l2 5v5M3 16h18M7 19.5v-3.5M17 19.5v-3.5" /><circle cx="8" cy="13" r=".6" /><circle cx="16" cy="13" r=".6" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.3C19.5 15.4 12 20 12 20z" />,
  home: <path d="M4 11l8-7 8 7v9H4zM10 20v-5h4v5" />,
  goal: <path d="M5 21V4M5 5h12l-2.5 3.5L17 12H5" />,
  shield: <path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z" />,
  plane: <path d="M21 4L3 11l7 3 3 7z" />,
  laptop: <><rect x="6" y="3" width="12" height="18" rx="2.5" /><path d="M11 18h2" /></>,
  bank: <path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />,
  cash: <><rect x="3" y="6" width="18" height="12" rx="3" /><circle cx="12" cy="12" r="2.5" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2" /></>,
}

export function CardIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <span className="ap-ic" style={{ background: `${color}22`, color }} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICON_PATHS[name]}</svg>
    </span>
  )
}

const DEMO = {
  en: {
    egp: 'EGP', talabat: 'Talabat', pharmacy: 'Pharmacy', careem: 'Careem', rent: 'Rent', carrefour: 'Carrefour',
    left: 'Left to spend', of: 'of 24,500', perDay: '687/day', until: 'until Nov 8', oct9: 'Oct 9', spent: 'spent 16,253', nov8: 'Nov 8',
    in: 'Money in', out: 'Money out', net: 'Net worth',
    laptop: 'New laptop', lapDate: 'Feb 2027', efund: 'Emergency fund', efDate: 'Jun 2027', trip: 'Summer trip', tripDate: 'Jul 2027',
    next: (a: string, b: string) => `Next: ${a} · ${b} to go`, add: 'Add money', ofw: 'of',
    avail: 'Available now', netw: 'Net worth', bank: 'Bank accounts', wallets: 'Wallets and cash', cash: 'Cash', mobile: 'Mobile wallet',
    due30: 'Due in the next 30 days', stream: 'Streaming plan', cloud: 'Cloud storage', music: 'Music', gym: 'Gym membership',
    d5: 'In 5 days', d6: 'In 6 days', d8: 'In 8 days', d15: 'In 15 days',
    inst: 'Installment', phone: 'Phone installment', paid: '8 of 12 paid', nextPay: 'Next payment Nov 10', outstanding: 'outstanding', left4: '4 × 1,200 left',
    oct: 'October 2026', byCat: 'Spending by category', groceries: 'Groceries', food: 'Food', transport: 'Transport', fun: 'Fun', avg: 'Avg. daily spend', big: 'Biggest purchase',
    planned: 'Every paycheck, planned', balanced: 'Balanced', due9: 'Due the 9th', everyPay: 'Every payday', ef2: 'Emergency fund',
  },
  ar: {
    egp: 'جنيه', talabat: 'طلبات', pharmacy: 'صيدلية', careem: 'كريم', rent: 'الإيجار', carrefour: 'كارفور',
    left: 'المتبقي للإنفاق', of: 'من 24,500', perDay: '687 / يوم', until: 'حتى 8 نوفمبر', oct9: '9 أكتوبر', spent: 'المنفق 16,253', nov8: '8 نوفمبر',
    in: 'الوارد', out: 'الصادر', net: 'صافي الثروة',
    laptop: 'حاسوب محمول جديد', lapDate: 'فبراير 2027', efund: 'صندوق الطوارئ', efDate: 'يونيو 2027', trip: 'رحلة الصيف', tripDate: 'يوليو 2027',
    next: (a: string, b: string) => `التالي: ${a} · يتبقى ${b}`, add: 'أضف مبلغًا', ofw: 'من',
    avail: 'المتاح الآن', netw: 'صافي الثروة', bank: 'الحسابات البنكية', wallets: 'المحافظ والنقد', cash: 'نقد', mobile: 'محفظة إلكترونية',
    due30: 'مستحق خلال 30 يومًا', stream: 'اشتراك المشاهدة', cloud: 'تخزين سحابي', music: 'موسيقى', gym: 'اشتراك النادي الرياضي',
    d5: 'بعد 5 أيام', d6: 'بعد 6 أيام', d8: 'بعد 8 أيام', d15: 'بعد 15 يومًا',
    inst: 'قسط', phone: 'قسط الهاتف', paid: '8 من 12 مدفوعة', nextPay: 'الدفعة القادمة 10 نوفمبر', outstanding: 'متبقي', left4: '4 × 1,200 متبقية',
    oct: 'أكتوبر 2026', byCat: 'الإنفاق بحسب الفئة', groceries: 'البقالة', food: 'طعام', transport: 'مواصلات', fun: 'ترفيه', avg: 'متوسط الإنفاق اليومي', big: 'أكبر عملية شراء',
    planned: 'كل راتب، موزّعًا', balanced: 'متوازنة', due9: 'يوم 9', everyPay: 'كل راتب', ef2: 'صندوق الطوارئ',
  },
} as const

type P = { locale: SiteLocale }

export function CardRow({ icon, color, title, sub, amount, locale }: { icon: IconName; color: string; title: string; sub: string; amount: string } & P) {
  return (
    <div className="ap-r">
      <CardIcon name={icon} color={color} />
      <div className="t"><b>{title}</b><span>{sub}</span></div>
      <div className="a">−{amount}<small>{DEMO[locale].egp}</small></div>
    </div>
  )
}

export function CardBand({ locale }: P) {
  const d = DEMO[locale]
  return (
    <div className="ap" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ap-band">
        <small>{d.left}</small>
        <div className="row1">
          <div><span className="big">8,247</span><span className="of">{d.of}</span></div>
          <div className="rt">{d.perDay}<br />{d.until}</div>
        </div>
        <div className="ap-bar"><i style={{ width: '66%' }} /></div>
        <div className="ap-bar2"><span>{d.oct9}</span><span>{d.spent}</span><span>{d.nov8}</span></div>
      </div>
      <div className="ap-tri">
        <div><small>{d.in}</small><b>+31,500</b></div>
        <div><small>{d.out}</small><b>−16,253</b></div>
        <div><small>{d.net}</small><b>103,907</b></div>
      </div>
    </div>
  )
}

export function CardTx({ index, locale }: { index: 0 | 1 } & P) {
  const d = DEMO[locale]
  const rows = [
    { icon: 'food' as const, color: '#E5684D', title: d.talabat, amount: '245.00' },
    { icon: 'heart' as const, color: '#2FA37A', title: d.pharmacy, amount: '148.00' },
  ]
  const r = rows[index]
  return <div className="ap"><CardRow locale={locale} icon={r.icon} color={r.color} title={r.title} sub="CIB Debit ·· 1234" amount={r.amount} /></div>
}

export function CardList({ locale }: P) {
  const d = DEMO[locale]
  return (
    <div className="ap" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <CardRow locale={locale} icon="food" color="#E5684D" title={d.talabat} sub="CIB ·· 1234" amount="245.00" />
      <CardRow locale={locale} icon="car" color="#389BD9" title={d.careem} sub="CIB ·· 1234" amount="96.00" />
      <CardRow locale={locale} icon="heart" color="#2FA37A" title={d.pharmacy} sub="CIB ·· 1234" amount="148.00" />
      <CardRow locale={locale} icon="home" color="#389BD9" title={d.rent} sub="NBE ·· 5520" amount="8,000.00" />
      <CardRow locale={locale} icon="food" color="#8B5CF6" title={d.carrefour} sub="CIB ·· 1234" amount="410.00" />
    </div>
  )
}

export function CardGoal({ index, locale }: { index: 0 | 1 | 2 } & P) {
  const d = DEMO[locale]
  const goals = [
    { icon: 'laptop' as const, color: '#8B5CF6', name: d.laptop, date: d.lapDate, pct: 40, saved: 12800, target: 32000, next: d.next('50%', '3,200') },
    { icon: 'shield' as const, color: '#12B0A0', name: d.efund, date: d.efDate, pct: 35, saved: 21000, target: 60000, next: d.next('50%', '9,000') },
    { icon: 'plane' as const, color: '#389BD9', name: d.trip, date: d.tripDate, pct: 21, saved: 9500, target: 45000, next: d.next('25%', '1,750') },
  ]
  const g = goals[index]
  return (
    <div className="ap" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ap-g">
        <div className="h"><CardIcon name={g.icon} color={g.color} /><div><b>{g.name}</b><span>{g.date}</span></div><em>{g.pct}%</em></div>
        <div className="amt">EGP {nf(g.saved)}<small>{d.ofw} {nf(g.target)}</small></div>
        <div className="ap-mil">
          <i style={{ width: `${g.pct}%` }} />
          {[25, 50, 75, 100].map((m) => <s key={m} style={{ insetInlineStart: `${m}%`, ...(g.pct >= m ? { background: '#12B0A0', borderColor: '#12B0A0' } : {}) }} />)}
        </div>
        <div className="f"><span>{g.next}</span><span className="ap-chip">{d.add}</span></div>
      </div>
    </div>
  )
}

export function CardAcc({ locale }: P) {
  const d = DEMO[locale]
  const row = (icon: IconName, color: string, title: string, sub: string | null, amount: string) => (
    <div className="ap-r" key={title}>
      <CardIcon name={icon} color={color} />
      <div className="t"><b>{title}</b>{sub ? <span>{sub}</span> : null}</div>
      <div className="a">{amount}</div>
    </div>
  )
  return (
    <div className="ap" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ap-band" style={{ paddingBottom: 14 }}>
        <small>{d.avail}</small>
        <div className="row1"><div><span className="big">63,127</span><span className="of">{d.egp}</span></div><div className="rt">103,907<br />{d.netw}</div></div>
      </div>
      <div className="ap-sec"><span>{d.bank}</span><span>2</span></div>
      {row('bank', '#12B0A0', 'CIB Current', '·· 1234', '29,401.00')}
      {row('bank', '#12B0A0', 'NBE Savings', '·· 5520', '26,400.00')}
      <div className="ap-sec"><span>{d.wallets}</span><span>2</span></div>
      {row('cash', '#566B68', d.cash, null, '4,350.00')}
      {row('wallet', '#F0A040', d.mobile, null, '2,976.00')}
    </div>
  )
}

export function CardSubs({ locale }: P) {
  const d = DEMO[locale]
  const rows = [[d.stream, 'SP', '#389BD9', d.d5, '199.00'], [d.cloud, 'CS', '#8B5CF6', d.d6, '49.00'], [d.music, 'MU', '#E5684D', d.d8, '89.00'], [d.gym, 'GM', '#2FA37A', d.d15, '600.00']]
  return (
    <div className="ap" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ap-band" style={{ paddingBottom: 14 }}>
        <small>{d.due30}</small>
        <div className="row1"><div><span className="big">937.00</span><span className="of">{d.egp}</span></div></div>
      </div>
      {rows.map((r) => (
        <div className="ap-r" key={r[0]}>
          <span className="ap-ic" aria-hidden style={{ background: `${r[2]}22`, color: r[2], font: '700 14px var(--f-sans)' }}>{r[1]}</span>
          <div className="t"><b>{r[0]}</b><span className="ap-pill" style={{ width: 'max-content' }}>{r[3]}</span></div>
          <div className="a">{r[4]}</div>
        </div>
      ))}
    </div>
  )
}

export function CardInst({ locale }: P) {
  const d = DEMO[locale]
  return (
    <div className="ap" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ap-g">
        <div className="h"><span className="ap-pill">{d.inst}</span></div>
        <b style={{ fontSize: 22 }}>{d.phone}</b>
        <div className="ap-seg">{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < 8 ? '' : 'o'} />)}</div>
        <div className="f"><span>{d.paid}</span><span>{d.nextPay}</span></div>
        <div className="amt">4,800<small>EGP {d.outstanding}</small></div>
        <div className="f"><span>{d.left4}</span><span>CIB Current</span></div>
      </div>
    </div>
  )
}

export function CardRep({ locale }: P) {
  const d = DEMO[locale]
  const cats: [string, number, string][] = [[d.rent, 8000, '#389BD9'], [d.groceries, 2810, '#8B5CF6'], [d.food, 1809, '#E5684D'], [d.transport, 812, '#12B0A0'], [d.fun, 640, '#F0BE5B']]
  return (
    <div className="ap" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ap-sec"><span>{d.oct}</span><span>{d.byCat}</span></div>
      <div className="ap-cat">
        {cats.map((c) => (
          <div className="c" key={c[0]}><div><span>{c[0]}</span><span className="n">{nf(c[1])}</span></div><i style={{ width: `${(c[1] / 8000) * 100}%`, background: c[2] }} /></div>
        ))}
      </div>
      <div className="ap-two"><div><small>{d.avg}</small><b>812.65</b></div><div><small>{d.big}</small><b>8,000</b></div></div>
    </div>
  )
}

export function CardBud({ locale }: P) {
  const d = DEMO[locale]
  return (
    <div className="ap" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ap-plan">
        <small style={{ font: '500 12px var(--f-mono)', color: '#566B68' }}>{d.planned}</small>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="num" style={{ fontSize: 30, fontWeight: 500 }}>EGP 28,000</span><span className="ap-pill">{d.balanced}</span>
        </div>
        <div className="seg"><i style={{ flex: 33.9, background: '#8B5CF6' }} /><i style={{ flex: 50, background: '#389BD9' }} /><i style={{ flex: 16.1, background: '#12B0A0' }} /></div>
      </div>
      <CardRow locale={locale} icon="home" color="#389BD9" title={d.rent} sub={d.due9} amount="8,000" />
      <CardRow locale={locale} icon="goal" color="#12B0A0" title={d.ef2} sub={d.everyPay} amount="1,500" />
    </div>
  )
}

export function Sms({ locale, text }: { locale: SiteLocale; text: ReactNode }) {
  return <div className="sms"><b><span>CIB</span><span>{locale === 'ar' ? 'الآن' : 'now'}</span></b>{text}</div>
}

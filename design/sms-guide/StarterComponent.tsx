/**
 * SmsTrackingGuide.tsx — STARTER SCAFFOLD (faithful port of the HTML prototype)
 * ---------------------------------------------------------------------------
 * This is a near-1:1 translation of `SMS Tracking Setup.dc.html` into a single
 * React/TSX component, using inline styles + the Buddget CSS variable tokens so it
 * renders identically to the prototype. It is intentionally self-contained so the
 * implementation does NOT drift from the approved design.
 *
 * WHAT TO WIRE UP (search for "TODO"):
 *   1. Replace the placeholder DS imports with your real components
 *      (Button, Badge, ExpenseRow, MoneyDisplay) from `src/components/`.
 *   2. Set ASSET_BASE to wherever you bundle 01.jpg … 14.jpg.
 *   3. Theme: by default this follows the `theme` prop; prefer binding to your
 *      existing theme context / `.dark` class instead (the app already has a
 *      light/dark setting — do NOT add a toggle).
 *   4. Clipboard + Shortcuts deep-link use Capacitor with web fallbacks (see helpers).
 *   5. `onClose` should dismiss the guide (router pop / modal close).
 *
 * Keep the STEPS array, the per-step coordinates, the copy, and the inline styles
 * AS-IS unless the design changes — they are the source of truth.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// TODO: point these at your real design-system components.
import { Button, Badge, ExpenseRow, MoneyDisplay } from '@/components';

// ── config ────────────────────────────────────────────────────────────────
const ASSET_BASE = '/guides/sms'; // TODO: where 01.jpg … 14.jpg live (public/ or import)
const RED = '#E50914';

const F = "'DM Sans', sans-serif";
const MONO = "'JetBrains Mono', monospace";
const AR = "'IBM Plex Sans Arabic', 'DM Sans', sans-serif";

const KW_EN = ['EGP', 'USD', 'charged', 'debited', 'purchase'];
const KW_AR = ['جنيه', 'دولار', 'خصم', 'شراء', 'عملية'];

// ── types ─────────────────────────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };
type Arrow = { x: number; y: number; dir: 'up' | 'down' };
type Step = {
  img?: string;
  title: string;
  desc: string; // *word* segments render in brand red
  r?: Rect | null;
  r2?: Rect;
  a?: Arrow | null;
  concept?: boolean;
  done?: boolean;
};

// ── step data (DO NOT reinterpret — these coordinates are hand-tuned) ───────
const STEPS: Step[] = [
  { img: '01.jpg', title: 'Open the Automation tab', desc: 'In the Shortcuts app, tap *Automation* at the bottom of the screen.',
    r: { x: 50, y: 96.3, w: 24, h: 4.2 }, a: { x: 50, y: 93.6, dir: 'down' } },
  { img: '02.jpg', title: 'Start a new automation', desc: 'Tap *New Automation* to begin — you only do this once.',
    r: { x: 50, y: 60.7, w: 42, h: 5 }, a: { x: 50, y: 57.6, dir: 'down' } },
  { img: '03.jpg', title: 'Pick the Message trigger', desc: 'Scroll the trigger list and choose *Message* — it fires whenever an SMS arrives.',
    r: { x: 34, y: 88, w: 56, h: 5 }, a: { x: 34, y: 85, dir: 'down' } },
  { img: '04.jpg', title: 'Open Message Contains', desc: 'Leave Sender empty, then tap *Choose* next to *Message Contains*.',
    r: { x: 84, y: 27.5, w: 24, h: 4.4 }, a: { x: 84, y: 24.8, dir: 'down' } },
  { concept: true, title: 'Think of a keyword', desc: 'First pick a word your bank *always* includes in its SMS — usually the currency. You’ll type it on the next screen.' },
  { img: '05.jpg', title: 'Enter your bank keyword', desc: 'Type the keyword you picked, then tap *Done*.',
    r: { x: 50, y: 39, w: 58, h: 5 }, a: { x: 50, y: 35.5, dir: 'down' } },
  { img: '06.jpg', title: 'Confirm and continue', desc: 'Make sure *Run Immediately* is ticked, then tap *Next*.',
    r: { x: 91, y: 5.6, w: 17, h: 3.6 }, a: { x: 88, y: 8, dir: 'up' }, r2: { x: 50, y: 43.2, w: 80, h: 4.6 } },
  { img: '07.jpg', title: 'Create a blank automation', desc: 'Tap *New Blank Automation* so you can add the Buddget action.',
    r: { x: 24.5, y: 37, w: 44, h: 14 }, a: { x: 24.5, y: 29.5, dir: 'down' } },
  { img: '08.jpg', title: 'Search for an action', desc: 'Tap the *Search Actions* bar at the bottom.',
    r: { x: 50, y: 56.5, w: 84, h: 4.2 }, a: { x: 50, y: 53.9, dir: 'down' } },
  { img: '09.jpg', title: 'Add Catch Bank SMS', desc: 'Type “Catch”, then tap *Catch Bank SMS* — the Buddget action.',
    r: { x: 48, y: 41.6, w: 84, h: 6 }, a: { x: 53, y: 47, dir: 'up' } },
  { img: '10.jpg', title: 'Open the message field', desc: 'Tap the blue *Bank Message* field to choose what gets passed in.',
    r: { x: 44, y: 33, w: 40, h: 4.6 }, a: { x: 44, y: 30, dir: 'down' } },
  { img: '11.jpg', title: 'Choose Select Variable', desc: 'In the options bar above the keyboard, tap *Select Variable*.',
    r: { x: 17, y: 63, w: 30, h: 3.8 }, a: { x: 17, y: 60, dir: 'down' } },
  { img: '12.jpg', title: 'Pick Shortcut Input', desc: 'Tap *Shortcut Input* so Buddget receives the full SMS text.',
    r: { x: 49, y: 34.5, w: 36, h: 3.8 }, a: { x: 49, y: 31.5, dir: 'down' } },
  { img: '13.jpg', title: 'Save the shortcut', desc: 'Tap *Done* — your automation is now ready.',
    r: { x: 91, y: 6.5, w: 16, h: 3.6 }, a: { x: 88, y: 9, dir: 'up' } },
  { img: '14.jpg', title: "You're all set",
    desc: 'Each keyword only catches SMS that contain it. A 2nd automation with another keyword (e.g. *USD* or *جنيه*) catches messages worded differently — so nothing slips through.',
    r: null, a: null, done: true },
];

// ── keyframes (inject once; or move these into globals.css) ─────────────────
const KEYFRAMES = `
@keyframes bg-pulseDot  { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes bg-ulPulse   { 0%,100%{opacity:.55} 50%{opacity:1} }
@keyframes bg-arrowBob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px)} }
@keyframes bg-heroFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes bg-heroDot   { 0%{top:-4px;opacity:0} 20%{opacity:1} 70%{top:30px;opacity:1} 85%,100%{top:30px;opacity:0} }
@keyframes bg-toastIn   { from{opacity:0;transform:translate(-50%,8px)} to{opacity:1;transform:translate(-50%,0)} }
`;
function useKeyframes() {
  useEffect(() => {
    if (document.getElementById('bg-sms-guide-kf')) return;
    const el = document.createElement('style');
    el.id = 'bg-sms-guide-kf';
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, []);
}

// ── platform helpers (Capacitor with web fallbacks) ─────────────────────────
async function copyText(text: string) {
  try { const { Clipboard } = await import('@capacitor/clipboard'); await Clipboard.write({ string: text }); return; } catch {}
  try { await navigator.clipboard.writeText(text); return; } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  } catch {}
}
async function openShortcuts() {
  try { const { AppLauncher } = await import('@capacitor/app-launcher'); await AppLauncher.openUrl({ url: 'shortcuts://' }); return; } catch {}
  window.location.href = 'shortcuts://';
}

// ── small inline-SVG helpers ────────────────────────────────────────────────
const ChatGlyph = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff" aria-hidden>
    <path d="M12 2C6.48 2 2 5.94 2 10.6c0 2.3 1.1 4.36 2.86 5.86L4 21l4.92-1.7c.97.26 2.01.4 3.08.4 5.52 0 10-3.94 10-8.5S17.52 2 12 2z" />
  </svg>
);
const CheckGlyph = ({ s = 11, sw = 3.2, c = 'currentColor' }: { s?: number; sw?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const CopyGlyph = ({ c = 'var(--color-brand-text-muted)' }: { c?: string }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// highlight *segments* in brand red
function renderDesc(desc: string) {
  return desc.split('*').map((part, i) =>
    i % 2 === 1
      ? <span key={i} style={{ color: RED, fontWeight: 700, fontFamily: AR }}>{part}</span>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

// ── annotations ─────────────────────────────────────────────────────────────
function Underline({ r }: { r?: Rect | null }) {
  if (!r) return null;
  const w = r.w * 0.92;
  return (
    <div style={{
      position: 'absolute', left: `${r.x - w / 2}%`, top: `${r.y + r.h / 2 + 0.4}%`,
      width: `${w}%`, height: 3, background: RED, borderRadius: 3,
      boxShadow: '0 0 7px rgba(229,9,20,0.55)', animation: 'bg-ulPulse 1.8s ease-in-out infinite',
      pointerEvents: 'none', zIndex: 11,
    }} />
  );
}
function ArrowMark({ a }: { a?: Arrow | null }) {
  if (!a) return null;
  const up = a.dir === 'up';
  return (
    <div style={{
      position: 'absolute', left: `${a.x}%`, top: `${a.y}%`,
      transform: up ? 'translate(-50%,0) scaleY(-1)' : 'translate(-50%,-100%)',
      zIndex: 12, pointerEvents: 'none',
    }}>
      <svg width={36} height={50} viewBox="0 0 46 62" fill="none"
        style={{ display: 'block', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.45))', animation: 'bg-arrowBob 1.5s ease-in-out infinite' }}>
        <path d="M25 6 C 15 24, 15 40, 23 51" stroke={RED} strokeWidth={5} strokeLinecap="round" />
        <path d="M23 55 L14 44 M23 55 L33 45" stroke={RED} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── intro hero ───────────────────────────────────────────────────────────────
function Hero() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '8px 0', animation: 'bg-heroFloat 5.5s ease-in-out infinite' }}>
      {/* incoming bank SMS */}
      <div style={{ width: 302, maxWidth: '100%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', borderRadius: 18, padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'flex-start', boxShadow: '0 10px 26px rgba(0,0,0,0.4)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#34C759', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChatGlyph /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-brand-text-primary)', fontFamily: F }}>MyBank</span>
            <span style={{ fontSize: 10.5, color: 'var(--color-brand-text-muted)', fontFamily: F }}>now</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-brand-text-secondary)', lineHeight: 1.45, fontFamily: F }}>
            Purchase of <span style={{ fontFamily: MONO, color: 'var(--color-brand-text-primary)' }}>EGP 45.00</span> at STARBUCKS on card ••4821.
          </div>
        </div>
      </div>
      {/* connector with traveling dot */}
      <div style={{ position: 'relative', width: 2, height: 36, background: 'var(--color-brand-border)', borderRadius: 2, margin: '7px 0' }}>
        <div style={{ position: 'absolute', left: -3, width: 8, height: 8, borderRadius: '50%', background: RED, boxShadow: '0 0 10px rgba(229,9,20,0.9)', animation: 'bg-heroDot 2.6s ease-in-out infinite' }} />
      </div>
      {/* parsed expense (reuse your DS components) */}
      <div style={{ width: 302, maxWidth: '100%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', borderRadius: 18, padding: '11px 11px 9px', boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, padding: '0 5px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)', fontFamily: F, whiteSpace: 'nowrap' }}>Logged in Buddget</span>
          {/* TODO: real <Badge variant="green"> */}
          <Badge variant="green"><CheckGlyph /> Auto-logged</Badge>
        </div>
        {/* TODO: real <ExpenseRow> (coffee icon, Starbucks/Coffee, EGP 45.00, Card ••4821) */}
        <ExpenseRow
          /* icon={<Coffee size={18} />} */
          iconBg="rgba(255,159,10,0.14)" iconColor="#FF9F0A"
          description="Starbucks" category="Coffee" amount={45} currency="EGP" method="Card ••4821"
        />
      </div>
    </div>
  );
}

// ── keyword teaching screen ───────────────────────────────────────────────────
function KeywordScreen({ onCopy }: { onCopy: (k: string) => void }) {
  const hl = (t: string, ar?: boolean) => (
    <span style={{ background: 'rgba(229,9,20,0.16)', color: RED, fontWeight: 800, padding: '1px 5px', borderRadius: 5, fontFamily: ar ? AR : MONO }}>{t}</span>
  );
  const Bubble = ({ rtl, children }: { rtl?: boolean; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#34C759', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChatGlyph s={13} /></div>
      <div style={{ maxWidth: 258, background: 'var(--color-brand-elevated)', border: '1px solid var(--color-brand-border)', borderRadius: rtl ? '15px 15px 4px 15px' : '15px 15px 15px 4px', padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-brand-text-primary)', fontFamily: rtl ? AR : F, direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>{children}</div>
    </div>
  );
  const Label = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)', fontFamily: F }}>{children}</div>
  );
  const Chip = ({ k, ar }: { k: string; ar?: boolean }) => (
    <button onClick={() => onCopy(k)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-brand-elevated)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text-primary)', fontSize: 13, fontWeight: 700, fontFamily: ar ? AR : MONO, padding: '7px 12px', borderRadius: 10, cursor: 'pointer' }}>
      {k}<CopyGlyph />
    </button>
  );
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 4px 0', overflow: 'hidden' }}>
        <Label>A message your bank sends</Label>
        <Bubble>Your card #2016 was charged {hl('EGP')} 20.00 at ****.COM.</Bubble>
        <Bubble rtl>تم خصم 20.00 {hl('جنيه', true)} من بطاقتك لدى ****.COM</Bubble>
        <div style={{ height: 2 }} />
        <Label>Common keywords · tap to copy</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{KW_EN.map(k => <Chip key={k} k={k} />)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, direction: 'rtl' }}>{KW_AR.map(k => <Chip key={k} k={k} ar />)}</div>
      </div>
    </div>
  );
}

// ── phone mock + overlay (and success state) ──────────────────────────────────
function PhoneMock({ step }: { step: Step }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <div style={{ height: '100%', aspectRatio: '1290 / 2581', maxWidth: '100%', background: '#050507', borderRadius: 30, padding: 5, boxShadow: '0 20px 55px rgba(0,0,0,0.6), 0 0 0 1px #1A1A24', position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 25, overflow: 'hidden', background: '#fff' }}>
          {step.img && <img src={`${ASSET_BASE}/${step.img}`} alt={step.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          <Underline r={step.r} />
          <Underline r={step.r2} />
          <ArrowMark a={step.a} />
          {step.done && (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 13 }}>
              <div style={{ width: 74, height: 74, borderRadius: '50%', background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 34px rgba(29,185,84,0.5)' }}>
                <CheckGlyph s={38} sw={3} c="#fff" />
              </div>
              <div style={{ background: 'rgba(10,10,15,0.86)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '7px 15px', borderRadius: 9999, fontFamily: F, border: '1px solid rgba(255,255,255,0.14)', whiteSpace: 'nowrap' }}>Automation active</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export type SmsTrackingGuideProps = {
  /** Prefer binding to your app theme context and removing this prop. */
  theme?: 'dark' | 'light';
  onClose?: () => void;
};

export default function SmsTrackingGuide({ theme = 'dark', onClose }: SmsTrackingGuideProps) {
  useKeyframes();
  const [step, setStep] = useState<1 | 2>(1); // 1 = intro, 2 = guided setup
  const [subStep, setSubStep] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  const total = STEPS.length;
  const safe = Math.min(Math.max(subStep, 0), total - 1);
  const cur = STEPS[safe];
  const pct = Math.round((safe / (total - 1)) * 100);
  const isLast = safe === total - 1;

  const onCopy = useCallback((k: string) => {
    copyText(k);
    setCopied(k);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1500);
  }, []);
  const close = useCallback(() => (onClose ? onClose() : window.history.back()), [onClose]);

  return (
    <div
      className={theme === 'light' ? '' : 'dark'} /* TODO: bind to app theme context */
      style={{ width: 390, height: 844, background: 'var(--color-brand-bg)', position: 'relative', overflow: 'hidden', fontFamily: F }}
    >
      <button onClick={close} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, zIndex: 60, width: 30, height: 30, borderRadius: '50%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="var(--color-brand-text-muted)" strokeWidth={1.6} strokeLinecap="round" /></svg>
      </button>

      {/* slider track */}
      <div style={{ width: 780, height: 844, display: 'flex', willChange: 'transform', transform: `translateX(${-(step - 1) * 390}px)`, transition: 'transform .44s cubic-bezier(.4,0,.2,1)' }}>

        {/* PANEL 1 — INTRO */}
        <section data-screen-label="Intro" style={{ width: 390, height: 844, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '24px 26px 0', flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(229,9,20,0.35)' }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1 }}>B</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-brand-text-primary)', letterSpacing: '-.2px' }}>Buddget</span>
          </div>

          <div style={{ height: 360, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}><Hero /></div>

          <div style={{ padding: '0 26px 0' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(229,9,20,0.09)', border: '1px solid rgba(229,9,20,0.22)', borderRadius: 9999, padding: '4px 12px', marginBottom: 13, width: 'fit-content', whiteSpace: 'nowrap' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: RED, animation: 'bg-pulseDot 2s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: RED, letterSpacing: '.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Automatic tracking</span>
            </div>
            <h1 style={{ fontSize: 29, fontWeight: 800, color: 'var(--color-brand-text-primary)', lineHeight: 1.16, marginBottom: 11, letterSpacing: '-.6px' }}>Every bank SMS,<br />logged for you</h1>
            <p style={{ fontSize: 14, color: 'var(--color-brand-text-secondary)', lineHeight: 1.65, maxWidth: 310 }}>The moment your bank texts you, Buddget reads the amount and merchant and records the transaction — automatically.</p>
          </div>

          <div style={{ marginTop: 'auto', padding: '14px 26px 44px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
              <span style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', lineHeight: 1.45 }}>Runs entirely on your iPhone. Buddget never sees your bank login.</span>
            </div>
            {/* TODO: real <Button> — full width, 52px tall */}
            <Button variant="default" style={{ width: '100%', height: 52, fontSize: 15, fontWeight: 700, borderRadius: 14, boxShadow: '0 10px 30px rgba(229,9,20,0.28)' }} onClick={() => { setStep(2); setSubStep(0); }}>Set up auto-tracking  →</Button>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-brand-text-muted)', marginTop: 11 }}>Takes about 2 minutes · one-time setup</p>
          </div>
        </section>

        {/* PANEL 2 — GUIDED SETUP */}
        <section data-screen-label="Guided setup" style={{ width: 390, height: 844, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '18px 20px 11px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingRight: 48, marginBottom: 9 }}>
              <button onClick={() => setStep(1)} aria-label="Back" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width={11} height={11} viewBox="0 0 12 12" fill="none"><path d="M7.5 1.5L3 6l4.5 4.5" stroke="var(--color-brand-text-muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-brand-text-primary)', letterSpacing: '-.2px' }}>Set up auto-tracking</span>
            </div>
            <div style={{ marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: 'var(--color-brand-text-muted)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em', whiteSpace: 'nowrap' }}>Step {safe + 1} of {total}</span>
            </div>
            <div style={{ height: 3, background: 'var(--color-brand-card)', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#E50914,#ff6a6a)', borderRadius: 9999, transition: 'width .4s cubic-bezier(.4,0,.2,1)' }} />
            </div>
          </div>

          <div style={{ flex: 1, padding: '2px 16px 0', minHeight: 0, display: 'flex' }}>
            {cur.concept ? <KeywordScreen onCopy={onCopy} /> : <PhoneMock step={cur} />}
          </div>

          <div style={{ padding: '12px 18px 4px', flexShrink: 0 }}>
            <div style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', borderRadius: 15, padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(229,9,20,0.14)', color: RED, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{safe + 1}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-brand-text-primary)' }}>{cur.title}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--color-brand-text-secondary)', lineHeight: 1.55, paddingLeft: 28 }}>{renderDesc(cur.desc)}</p>
            </div>
          </div>

          <div style={{ padding: '10px 18px 6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setSubStep(s => Math.max(0, s - 1))} aria-label="Previous" style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={13} height={13} viewBox="0 0 12 12" fill="none"><path d="M7.5 1.5L3 6l4.5 4.5" stroke={safe > 0 ? '#9898B0' : '#5A5A72'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {STEPS.map((_, i) => (
                <button key={i} onClick={() => setSubStep(i)} aria-label={`Step ${i + 1}`} style={{ height: 6, width: i === safe ? 20 : 6, borderRadius: 9999, cursor: 'pointer', border: 'none', padding: 0, transition: 'all .28s cubic-bezier(.4,0,.2,1)', background: i === safe ? RED : i < safe ? '#1DB954' : 'var(--color-brand-border)' }} />
              ))}
            </div>
            <button onClick={() => setSubStep(s => Math.min(total - 1, s + 1))} aria-label="Next" style={{ width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isLast ? RED : 'var(--color-brand-card)', border: `1px solid ${isLast ? 'transparent' : 'var(--color-brand-border)'}` }}>
              <svg width={13} height={13} viewBox="0 0 12 12" fill="none"><path d="M4.5 1.5L9 6l-4.5 4.5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          <div style={{ padding: '6px 20px 26px', flexShrink: 0 }}>
            {cur.concept ? (
              <div style={{ height: 1 }} />
            ) : cur.done ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setStep(2); setSubStep(0); }} style={{ flex: 1, height: 46, borderRadius: 13, cursor: 'pointer', fontFamily: F, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', background: RED, color: '#fff', boxShadow: '0 8px 22px rgba(229,9,20,0.26)' }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  Add keyword
                </button>
                <button onClick={close} style={{ flex: 1, height: 46, borderRadius: 13, cursor: 'pointer', fontFamily: F, fontSize: 14, fontWeight: 700, border: '1px solid var(--color-brand-border)', background: 'transparent', color: 'var(--color-brand-text-secondary)' }}>Finish</button>
              </div>
            ) : (
              /* TODO: real <Button> */
              <Button variant="default" style={{ width: '100%', height: 52, fontSize: 15, fontWeight: 700, borderRadius: 14, boxShadow: '0 10px 30px rgba(229,9,20,0.28)' }} onClick={openShortcuts}>Open Shortcuts app</Button>
            )}
          </div>
        </section>
      </div>

      {/* toast */}
      {copied && (
        <div style={{ position: 'absolute', bottom: 92, left: '50%', transform: 'translateX(-50%)', zIndex: 80, background: 'rgba(10,10,15,0.92)', color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '9px 16px', borderRadius: 9999, border: '1px solid rgba(255,255,255,0.16)', animation: 'bg-toastIn .2s ease', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7, fontFamily: F }}>
          <CheckGlyph s={13} sw={3} c="#1DB954" /> Copied “{copied}”
        </div>
      )}
    </div>
  );
}

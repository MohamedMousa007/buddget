'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Coffee, Copy, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { useT } from '@/lib/i18n';

// ── config ────────────────────────────────────────────────────────────────
const ASSET_BASE = '/guides/sms';
const RED = '#E50914';

const F = 'var(--font-sans)';
const MONO = 'var(--font-mono)';
const AR = 'var(--font-sans-ar)';

const KW_EN = ['EGP', 'USD', 'charged', 'debited', 'purchase'];
const KW_AR = ['جنيه', 'دولار', 'خصم', 'شراء', 'عملية'];

// ── types ─────────────────────────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };
type Arrow = { x: number; y: number; dir: 'up' | 'down' };
type Step = {
  img?: string;
  r?: Rect | null;
  r2?: Rect;
  a?: Arrow | null;
  concept?: boolean;
  done?: boolean;
};

// ── step data (DO NOT reinterpret — these coordinates are hand-tuned) ───────
const STEPS: Step[] = [
  { img: '01.jpg', r: { x: 50, y: 96.3, w: 24, h: 4.2 }, a: { x: 50, y: 93.6, dir: 'down' } },
  { img: '02.jpg', r: { x: 50, y: 60.7, w: 42, h: 5 }, a: { x: 50, y: 57.6, dir: 'down' } },
  { img: '03.jpg', r: { x: 34, y: 88, w: 56, h: 5 }, a: { x: 34, y: 85, dir: 'down' } },
  { img: '04.jpg', r: { x: 84, y: 27.5, w: 24, h: 4.4 }, a: { x: 84, y: 24.8, dir: 'down' } },
  { concept: true },
  { img: '05.jpg', r: { x: 50, y: 39, w: 58, h: 5 }, a: { x: 50, y: 35.5, dir: 'down' } },
  { img: '06.jpg', r: { x: 91, y: 5.6, w: 17, h: 3.6 }, a: { x: 88, y: 8, dir: 'up' }, r2: { x: 50, y: 43.2, w: 80, h: 4.6 } },
  { img: '07.jpg', r: { x: 24.5, y: 37, w: 44, h: 14 }, a: { x: 24.5, y: 29.5, dir: 'down' } },
  { img: '08.jpg', r: { x: 50, y: 56.5, w: 84, h: 4.2 }, a: { x: 50, y: 53.9, dir: 'down' } },
  { img: '09.jpg', r: { x: 48, y: 41.6, w: 84, h: 6 }, a: { x: 53, y: 47, dir: 'up' } },
  { img: '10.jpg', r: { x: 44, y: 33, w: 40, h: 4.6 }, a: { x: 44, y: 30, dir: 'down' } },
  { img: '11.jpg', r: { x: 17, y: 63, w: 30, h: 3.8 }, a: { x: 17, y: 60, dir: 'down' } },
  { img: '12.jpg', r: { x: 49, y: 34.5, w: 36, h: 3.8 }, a: { x: 49, y: 31.5, dir: 'down' } },
  { img: '13.jpg', r: { x: 91, y: 6.5, w: 16, h: 3.6 }, a: { x: 88, y: 9, dir: 'up' } },
  { img: '14.jpg', r: null, a: null, done: true },
];

// ── keyframes (inject once) ─────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes bg-pulseDot  { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes bg-ulPulse   { 0%,100%{opacity:.55} 50%{opacity:1} }
@keyframes bg-arrowBob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px)} }
@keyframes bg-heroFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes bg-heroDot   { 0%{top:-4px;opacity:0} 20%{opacity:1} 70%{top:30px;opacity:1} 85%,100%{top:30px;opacity:0} }
@keyframes bg-toastIn   { from{opacity:0;transform:translate(-50%,8px)} to{opacity:1;transform:translate(-50%,0)} }
@keyframes bg-slideR    { from{opacity:0;transform:translateX(26px)} to{opacity:1;transform:translateX(0)} }
@keyframes bg-slideL    { from{opacity:0;transform:translateX(-26px)} to{opacity:1;transform:translateX(0)} }
@keyframes bg-fadeUp    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
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

// ── Messages glyph ────────────────────────────────────────────────────────────
const ChatGlyph = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff" aria-hidden>
    <path d="M12 2C6.48 2 2 5.94 2 10.6c0 2.3 1.1 4.36 2.86 5.86L4 21l4.92-1.7c.97.26 2.01.4 3.08.4 5.52 0 10-3.94 10-8.5S17.52 2 12 2z" />
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
  const t = useT();
  const g = t.smsTracking.guide;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '8px 0', animation: 'bg-heroFloat 5.5s ease-in-out infinite' }}>
      <div style={{ width: 302, maxWidth: '100%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', borderRadius: 18, padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'flex-start', boxShadow: '0 10px 26px rgba(0,0,0,0.4)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#34C759', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChatGlyph /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-brand-text-primary)', fontFamily: F }}>{g.heroBankName}</span>
            <span style={{ fontSize: 10.5, color: 'var(--color-brand-text-muted)', fontFamily: F }}>{g.heroNow}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-brand-text-secondary)', lineHeight: 1.45, fontFamily: F }}>
            {g.heroSmsPre}<span style={{ fontFamily: MONO, color: 'var(--color-brand-text-primary)' }}>{g.heroSmsAmount}</span>{g.heroSmsPost}
          </div>
        </div>
      </div>
      <div style={{ position: 'relative', width: 2, height: 36, background: 'var(--color-brand-border)', borderRadius: 2, margin: '7px 0' }}>
        <div style={{ position: 'absolute', left: -3, width: 8, height: 8, borderRadius: '50%', background: RED, boxShadow: '0 0 10px rgba(229,9,20,0.9)', animation: 'bg-heroDot 2.6s ease-in-out infinite' }} />
      </div>
      <div style={{ width: 302, maxWidth: '100%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', borderRadius: 18, padding: '11px 11px 9px', boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, padding: '0 5px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)', fontFamily: F, whiteSpace: 'nowrap' }}>{g.heroLoggedLabel}</span>
          <Badge variant="secondary" className="gap-1 border-transparent bg-[var(--color-brand-green)]/15 text-[var(--color-brand-green)]">
            <Check className="size-3" /> {g.heroAutoLogged}
          </Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '2px 5px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,159,10,0.14)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coffee size={18} color="#FF9F0A" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand-text-primary)', fontFamily: F, lineHeight: 1.3 }}>{g.heroMerchant}</div>
            <div style={{ fontSize: 11, color: 'var(--color-brand-text-muted)', fontFamily: F, lineHeight: 1.3 }}>{g.heroCategory}</div>
          </div>
          <div style={{ textAlign: 'end', flexShrink: 0 }}>
            <MoneyDisplay amount={45} currency="EGP" variant="table" primaryClassName="text-[13px] font-bold text-[var(--color-brand-text-primary)]" />
            <div style={{ fontSize: 11, color: 'var(--color-brand-text-muted)', fontFamily: F, lineHeight: 1.3 }}>{g.heroMethod}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── keyword teaching screen ───────────────────────────────────────────────────
const kwHl = (text: string, ar?: boolean) => (
  <span style={{ background: 'rgba(229,9,20,0.16)', color: RED, fontWeight: 800, padding: '1px 5px', borderRadius: 5, fontFamily: ar ? AR : MONO }}>{text}</span>
);
const KwBubble = ({ rtl, children }: { rtl?: boolean; children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#34C759', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChatGlyph s={13} /></div>
    <div style={{ maxWidth: 258, background: 'var(--color-brand-elevated)', border: '1px solid var(--color-brand-border)', borderRadius: rtl ? '15px 15px 4px 15px' : '15px 15px 15px 4px', padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-brand-text-primary)', fontFamily: rtl ? AR : F, direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>{children}</div>
  </div>
);
const KwLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)', fontFamily: F }}>{children}</div>
);
const KwChip = ({ k, ar, onCopy }: { k: string; ar?: boolean; onCopy: (k: string) => void }) => (
  <button onClick={() => onCopy(k)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-brand-elevated)', border: '1px solid var(--color-brand-border)', color: 'var(--color-brand-text-primary)', fontSize: 13, fontWeight: 700, fontFamily: ar ? AR : MONO, padding: '7px 12px', borderRadius: 10, cursor: 'pointer' }}>
    {k}<Copy size={14} color="var(--color-brand-text-muted)" />
  </button>
);

// Concept step animation phases:
// 0 = blank, 1 = header, 2 = SMS examples + arrow, 3 = chips, 4+ = step box visible
function KeywordScreen({ onCopy, phase }: { onCopy: (k: string) => void; phase: number }) {
  const t = useT();
  const g = t.smsTracking.guide;

  const vis = (minPhase: number, dir: 'R' | 'L' | 'U' = 'R') => ({
    opacity: phase >= minPhase ? 1 : 0,
    animation: phase >= minPhase ? `bg-slide${dir} .45s cubic-bezier(.22,1,.36,1) both` : 'none',
    pointerEvents: (phase >= minPhase ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
  });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: 0, paddingTop: 4 }}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: '0 4px', overflow: 'hidden' }}>

        {/* Header — phase 1, slides from right */}
        <div style={{ ...vis(1, 'R'), transition: 'opacity .35s' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-brand-text-primary)', fontFamily: F, lineHeight: 1.25, letterSpacing: '-.3px', marginBottom: 4 }}>
            {g.kwHeaderTitle}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--color-brand-text-secondary)', lineHeight: 1.55, fontFamily: F }}>
            {g.kwHeaderBody}
          </p>
        </div>

        {/* SMS examples — phase 2, slides from left */}
        <div style={{ ...vis(2, 'L'), transition: 'opacity .35s', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <KwLabel>{g.kwSentLabel}</KwLabel>
          {/* Arrow pointing at the highlighted keyword in the first bubble */}
          <div style={{ position: 'relative' }}>
            <KwBubble>{g.kwEnPre}{kwHl(g.kwEnHl)}{g.kwEnPost}</KwBubble>
            <div style={{ position: 'absolute', top: -28, left: 84, pointerEvents: 'none', zIndex: 5 }}>
              <svg width={28} height={38} viewBox="0 0 46 62" fill="none"
                style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))', animation: 'bg-arrowBob 1.5s ease-in-out infinite' }}>
                <path d="M25 6 C 15 24, 15 40, 23 51" stroke={RED} strokeWidth={5} strokeLinecap="round" />
                <path d="M23 55 L14 44 M23 55 L33 45" stroke={RED} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <KwBubble rtl>{g.kwArPre}{kwHl(g.kwArHl, true)}{g.kwArPost}</KwBubble>
        </div>

        {/* Keyword chips — phase 3, slides from right */}
        <div style={{ ...vis(3, 'R'), transition: 'opacity .35s', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <KwLabel>{g.kwCommonLabel}</KwLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{KW_EN.map(k => <KwChip key={k} k={k} onCopy={onCopy} />)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, direction: 'rtl' }}>{KW_AR.map(k => <KwChip key={k} k={k} ar onCopy={onCopy} />)}</div>
        </div>

      </div>
    </div>
  );
}

// ── phone mock + overlay (and success state) ──────────────────────────────────
function PhoneMock({ step, title }: { step: Step; title: string }) {
  const t = useT();
  const g = t.smsTracking.guide;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      {/* thinner frame: padding 3 vs old 5 */}
      <div style={{ height: '100%', aspectRatio: '1290 / 2581', maxWidth: '100%', background: '#050507', borderRadius: 28, padding: 3, boxShadow: '0 20px 55px rgba(0,0,0,0.6), 0 0 0 1px #1A1A24', position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 25, overflow: 'hidden', background: '#fff' }}>
          {/* Dynamic Island */}
          <div style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: 82, height: 22, borderRadius: 11, background: '#050507', zIndex: 15, pointerEvents: 'none' }} />
          {step.img && <img src={`${ASSET_BASE}/${step.img}`} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          <Underline r={step.r} />
          <Underline r={step.r2} />
          <ArrowMark a={step.a} />
          {step.done && (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 13 }}>
              <div style={{ width: 74, height: 74, borderRadius: '50%', background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 34px rgba(29,185,84,0.5)' }}>
                <Check size={38} strokeWidth={3} color="#fff" />
              </div>
              <div style={{ background: 'rgba(10,10,15,0.86)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '7px 15px', borderRadius: 9999, fontFamily: F, border: '1px solid rgba(255,255,255,0.14)', whiteSpace: 'nowrap' }}>{g.automationActive}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export type SmsTrackingGuideProps = {
  onClose?: () => void;
};

export default function SmsTrackingGuide({ onClose }: SmsTrackingGuideProps) {
  useKeyframes();
  const t = useT();
  const g = t.smsTracking.guide;
  const [step, setStep] = useState<1 | 2>(1);
  const [subStep, setSubStep] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  // conceptState tracks which subStep the animation was started for + its phase.
  // conceptPhase derives as 0 whenever safe changes, avoiding synchronous setState in effects.
  const [conceptState, setConceptState] = useState<{ step: number; phase: number }>({ step: -1, phase: 0 });
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const total = STEPS.length;
  const safe = Math.min(Math.max(subStep, 0), total - 1);
  const cur = STEPS[safe];
  const curCopy = g.steps[safe];
  const pct = Math.round((safe / (total - 1)) * 100);
  const isLast = safe === total - 1;

  // Drive concept-screen animation phases.
  // conceptState.step !== safe means phase is 0 (derived), so no synchronous setState needed.
  useEffect(() => {
    if (!cur.concept) return;
    const t1 = setTimeout(() => setConceptState({ step: safe, phase: 1 }), 180);
    const t2 = setTimeout(() => setConceptState({ step: safe, phase: 2 }), 820);
    const t3 = setTimeout(() => setConceptState({ step: safe, phase: 3 }), 1480);
    const t4 = setTimeout(() => setConceptState({ step: safe, phase: 4 }), 2050);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [safe, cur.concept]);

  const onCopy = useCallback((k: string) => {
    copyText(k);
    setCopied(k);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1500);
  }, []);
  const close = useCallback(() => (onClose ? onClose() : window.history.back()), [onClose]);

  const conceptPhase = conceptState.step === safe ? conceptState.phase : 0;
  const stepBoxVisible = !cur.concept || conceptPhase >= 4;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-brand-bg)', fontFamily: F }}>
      <div style={{ width: 390, height: 844, maxWidth: '100%', maxHeight: '100%', background: 'var(--color-brand-bg)', position: 'relative', overflow: 'hidden', fontFamily: F }}>
        <button onClick={close} aria-label={g.ariaClose} style={{ position: 'absolute', top: 16, right: 16, zIndex: 60, width: 30, height: 30, borderRadius: '50%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={14} strokeWidth={2} color="var(--color-brand-text-muted)" />
        </button>

        {/* slider track */}
        <div style={{ width: 780, height: 844, display: 'flex', willChange: 'transform', transform: `translateX(${-(step - 1) * 390}px)`, transition: 'transform .44s cubic-bezier(.4,0,.2,1)' }}>

          {/* PANEL 1 — INTRO */}
          <section data-screen-label="Intro" style={{ width: 390, height: 844, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '24px 26px 0', flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(229,9,20,0.35)' }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1 }}>B</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-brand-text-primary)', letterSpacing: '-.2px' }}>{g.brand}</span>
            </div>

            <div style={{ height: 360, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}><Hero /></div>

            <div style={{ padding: '0 26px 0' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(229,9,20,0.09)', border: '1px solid rgba(229,9,20,0.22)', borderRadius: 9999, padding: '4px 12px', marginBottom: 13, width: 'fit-content', whiteSpace: 'nowrap' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: RED, animation: 'bg-pulseDot 2s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: RED, letterSpacing: '.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{g.introBadge}</span>
              </div>
              <h1 style={{ fontSize: 29, fontWeight: 800, color: 'var(--color-brand-text-primary)', lineHeight: 1.16, marginBottom: 11, letterSpacing: '-.6px' }}>{g.introTitle1}<br />{g.introTitle2}</h1>
              <p style={{ fontSize: 14, color: 'var(--color-brand-text-secondary)', lineHeight: 1.65, maxWidth: 310 }}>{g.introBody}</p>
            </div>

            <div style={{ marginTop: 'auto', padding: '14px 26px 44px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
                <span style={{ fontSize: 12, color: 'var(--color-brand-text-muted)', lineHeight: 1.45 }}>{g.trust}</span>
              </div>
              <Button variant="default" style={{ width: '100%', height: 52, fontSize: 15, fontWeight: 700, borderRadius: 14, boxShadow: '0 10px 30px rgba(229,9,20,0.28)' }} onClick={() => { setStep(2); setSubStep(0); }}>{g.cta}</Button>
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-brand-text-muted)', marginTop: 11 }}>{g.ctaCaption}</p>
            </div>
          </section>

          {/* PANEL 2 — GUIDED SETUP */}
          <section data-screen-label="Guided setup" style={{ width: 390, height: 844, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {/* Header */}
            <div style={{ padding: '18px 20px 11px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingRight: 48, marginBottom: 9 }}>
                <button onClick={() => setStep(1)} aria-label={g.ariaBack} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ChevronLeft size={14} color="var(--color-brand-text-muted)" />
                </button>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-brand-text-primary)', letterSpacing: '-.2px' }}>{g.setupTitle}</span>
              </div>
              <div style={{ marginBottom: 7 }}>
                <span style={{ fontSize: 11, color: 'var(--color-brand-text-muted)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{g.stepOf(safe + 1, total)}</span>
              </div>
              <div style={{ height: 3, background: 'var(--color-brand-card)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#E50914,#ff6a6a)', borderRadius: 9999, transition: 'width .4s cubic-bezier(.4,0,.2,1)' }} />
              </div>
            </div>

            {/* Content area — sits below phone shadow */}
            <div style={{ flex: 1, padding: '2px 16px 0', minHeight: 0, display: 'flex', position: 'relative', zIndex: 1 }}>
              {cur.concept
                ? <KeywordScreen onCopy={onCopy} phase={conceptPhase} />
                : <PhoneMock step={cur} title={curCopy.title} />}
            </div>

            {/* Step text box — z-index 2 so it sits above the phone shadow */}
            <div style={{ padding: '12px 18px 4px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
              <div
                style={{
                  background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', borderRadius: 15, padding: '13px 15px',
                  opacity: stepBoxVisible ? 1 : 0,
                  transform: stepBoxVisible ? 'none' : 'translateY(6px)',
                  transition: 'opacity .4s ease, transform .4s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(229,9,20,0.14)', color: RED, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{safe + 1}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-brand-text-primary)' }}>{curCopy.title}</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--color-brand-text-secondary)', lineHeight: 1.55, paddingLeft: 28 }}>{renderDesc(curCopy.desc)}</p>
              </div>
            </div>

            {/* Nav arrows + dot indicators */}
            <div style={{ padding: '10px 18px 6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
              <button
                onClick={() => setSubStep(s => Math.max(0, s - 1))}
                aria-label={g.ariaPrev}
                style={{
                  width: 38, height: 38, borderRadius: '50%', background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: safe > 0 ? '0 0 14px rgba(229,9,20,0.2), 0 2px 8px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.08)',
                  transition: 'box-shadow .25s',
                }}
              >
                <ChevronLeft size={16} color={safe > 0 ? 'var(--color-brand-text-primary)' : 'var(--color-brand-border)'} />
              </button>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {STEPS.map((_, i) => (
                  <button key={i} onClick={() => setSubStep(i)} aria-label={g.ariaStep(i + 1)} style={{ height: 6, width: i === safe ? 20 : 6, borderRadius: 9999, cursor: 'pointer', border: 'none', padding: 0, transition: 'all .28s cubic-bezier(.4,0,.2,1)', background: i === safe ? RED : i < safe ? '#1DB954' : 'var(--color-brand-border)' }} />
                ))}
              </div>
              <button
                onClick={() => setSubStep(s => Math.min(total - 1, s + 1))}
                aria-label={g.ariaNext}
                style={{
                  width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isLast ? RED : 'var(--color-brand-card)',
                  border: `1px solid ${isLast ? 'transparent' : 'var(--color-brand-border)'}`,
                  boxShadow: isLast ? '0 0 22px rgba(229,9,20,0.5), 0 4px 14px rgba(229,9,20,0.3)' : '0 0 14px rgba(229,9,20,0.18), 0 2px 8px rgba(0,0,0,0.12)',
                  transition: 'box-shadow .25s, background .25s',
                }}
              >
                <ChevronRight size={16} color={isLast ? '#fff' : 'var(--color-brand-text-primary)'} />
              </button>
            </div>

            {/* CTA button — always shows "Open Shortcuts" except on the done step */}
            <div style={{ padding: '6px 20px 26px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
              {cur.done ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setStep(2); setSubStep(0); }} style={{ flex: 1, height: 46, borderRadius: 13, cursor: 'pointer', fontFamily: F, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', background: RED, color: '#fff', boxShadow: '0 8px 22px rgba(229,9,20,0.26)' }}>
                    <Plus size={14} strokeWidth={2.4} color="#fff" />
                    {g.addKeyword}
                  </button>
                  <button onClick={close} style={{ flex: 1, height: 46, borderRadius: 13, cursor: 'pointer', fontFamily: F, fontSize: 14, fontWeight: 700, border: '1px solid var(--color-brand-border)', background: 'transparent', color: 'var(--color-brand-text-secondary)' }}>{g.finish}</button>
                </div>
              ) : (
                <Button variant="default" style={{ width: '100%', height: 52, fontSize: 15, fontWeight: 700, borderRadius: 14, boxShadow: '0 10px 30px rgba(229,9,20,0.28)' }} onClick={openShortcuts}>{g.openShortcuts}</Button>
              )}
            </div>
          </section>
        </div>

        {/* toast */}
        {copied && (
          <div style={{ position: 'absolute', bottom: 92, left: '50%', transform: 'translateX(-50%)', zIndex: 80, background: 'rgba(10,10,15,0.92)', color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '9px 16px', borderRadius: 9999, border: '1px solid rgba(255,255,255,0.16)', animation: 'bg-toastIn .2s ease', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 7, fontFamily: F }}>
            <Check size={13} strokeWidth={3} color="#1DB954" /> {g.copied(copied)}
          </div>
        )}
      </div>
    </div>
  );
}

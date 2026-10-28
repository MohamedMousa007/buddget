import type { ScreenKey } from '../screens'

export type Link = { label: string; slug: string }
export type Faq = { q: string; a: string }
export type ScreenCaption = { screen: ScreenKey; title: string; cap: string }

export type Feature = {
  slug: string
  name: string
  short: string
  h1: string
  lede: string
  screen: ScreenKey
  heading: string
  body: string
  bullets: string[]
  faq: Faq[]
}

export type Guide = {
  slug: string
  title: string
  description: string
  category: string
  minutes: number
  published: string
  answer: string
  sections: { h: string; p: string[] }[]
  cta: string
}

export type Review = { quote: string; name: string; meta: string; initial: string }

export type PageIntro = { eyebrow: string; h1: string; lede: string }

export type SiteContent = {
  locale: 'en' | 'ar'
  name: string
  meta: { homeTitle: string; homeDescription: string }
  announce: { text: string; slug: string }
  nav: { features: string; how: string; pricing: string; security: string; help: string; menu: string; close: string; cta: string; skip: string; switchLabel: string; switchTo: string }
  footer: {
    tag: string; follow: string
    product: string; learn: string; company: string; legal: string
    links: Record<string, string>
    copy: string; legalNote: string
  }
  common: { getApp: string; seeHow: string; joinBeta: string; readMore: string; home: string; breadcrumb: string; contactUs: string; example: string; free: string; share: string }
  home: {
    hero: { h1: string; lede: string; assurances: string[]; tabs: { key: ScreenKey; label: string }[] }
    answers: { h2: string; lede: string; items: { eyebrow: string; h: string; p: string; bullets: string[]; link: Link; screens: [ScreenKey, ScreenKey] }[] }
    how: { h2: string; lede: string; steps: { n: string; h: string; p: string; screen: ScreenKey }[]; stat: { value: string; text: string }; note: string }
    calc: { eyebrow: string; h2: string; lede: string; link: Link; income: string; bills: string; save: string; result: string; cta: string; note: string; currency: string }
    buddgy: { pill: string; h2: string; lede: string; qa: { q: string; a1: string; a2: string }[]; disclaimer: string; sample: string }
    gallery: { eyebrow: string; h2: string; lede: string; items: ScreenCaption[] }
    reviews: { h2: string; sub: string; sample: string }
    trust: { h: string; p: string; link: Link }[]
    faq: { h2: string; items: Faq[] }
    final: { h2: string; lede: string; soon: string }
  }
  features: { intro: PageIntro; core: string; items: Feature[]; hubCta: string }
  how: { intro: PageIntro; steps: { n: string; h: string; p: string; screen: ScreenKey }[]; ctaH: string; ctaP: string }
  pricing: {
    intro: PageIntro
    free: { name: string; tag: string; price: string; items: string[]; cta: string }
    plus: { name: string; tag: string; price: string; items: string[]; cta: string }
    note: string
    faq: Faq[]
  }
  download: { intro: PageIntro; betaH: string; betaP: string; emailLabel: string; emailPlaceholder: string; submit: string; sent: string; error: string; soonApple: string; soonGoogle: string; badge: string; storeGet: string; webApp: string; steps: { h: string; p: string }[] }
  security: { intro: PageIntro; cards: { h: string; p: string }[]; dataH: string; data: { k: string; v: string }[]; policyCta: string; faq: Faq[] }
  support: { intro: PageIntro; groups: { h: string; items: Faq[] }[]; stillH: string; stillP: string; inApp: string }
  contact: { intro: PageIntro; emailH: string; emailP: string; appH: string; appP: string; followH: string; responseNote: string; formH: string; name: string; email: string; message: string; send: string; sent: string; error: string }
  about: { intro: PageIntro; pillars: { h: string; p: string }[]; storyH: string; story: string[]; followH: string; followP: string }
  press: { intro: PageIntro; aboutH: string; boilerplate: string; facts: { k: string; v: string }[]; logoH: string; colorsH: string; colors: { name: string; hex: string; token: string }[]; screensH: string; contactH: string; contactP: string }
  ai: { intro: PageIntro; facts: { k: string; v: string }[]; updated: string }
  guides: { intro: PageIntro; items: Guide[]; readLabel: string; minLabel: string; relatedH: string }
  tools: {
    intro: PageIntro
    items: { slug: string; name: string; desc: string }[]
    daily: { intro: PageIntro; explainH: string; explain: string[]; cta: string }
    emergency: { intro: PageIntro; essentials: string; months: string; saving: string; target: string; time: string; monthsUnit: string; explainH: string; explain: string[]; cta: string; currentH: string }
  }
  deleteAccount: { intro: PageIntro; appH: string; steps: string[]; emailH: string; emailP: string; mailSubject: string; whatH: string; what: string[]; keepH: string; keep: string }
  glossary: { intro: PageIntro; terms: { term: string; def: string }[] }
  compare: { intro: PageIntro; cols: [string, string]; rows: { f: string; a: string; b: string }[]; honestH: string; honest: string; cta: string }
  cookies: { intro: PageIntro; sections: { h: string; p: string }[] }
  notFound: { h: string; p: string; home: string; help: string }
}

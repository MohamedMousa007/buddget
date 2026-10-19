import { newBlock, type EmailBlock } from './blocks'
import type { EmailLocale } from './scenarios'

export interface TemplateContent {
  subject: string
  preheader: string
  blocks: EmailBlock[]
}

interface Copy {
  subject: string
  preheader: string
  eyebrow?: string
  title: string
  intro: string
  /** Label above the code box; omit for no code. */
  code?: string
  button?: string
  /** A "what happens next" / fallback paragraph shown under the main action. */
  extra?: string
  noteTitle: string
  noteText: string
}

const CHROME: Record<EmailLocale, { expiry: string; footer: string }> = {
  en: { expiry: 'Expires in {{expires_in}}', footer: 'Sent by Buddget\nThis is an automated message, please don’t reply.' },
  ar: { expiry: 'تنتهي الصلاحية خلال {{expires_in}}', footer: 'أُرسلت من Buddget\nهذه رسالة آلية، يُرجى عدم الرد عليها.' },
}

function build(locale: EmailLocale, c: Copy, withExpiry: boolean): TemplateContent {
  const blocks: EmailBlock[] = [
    newBlock('logo'),
    { ...(newBlock('heading') as Extract<EmailBlock, { type: 'heading' }>), eyebrow: c.eyebrow ?? '', text: c.title },
    { ...(newBlock('paragraph') as Extract<EmailBlock, { type: 'paragraph' }>), text: c.intro },
  ]
  if (c.button) blocks.push({ ...(newBlock('button') as Extract<EmailBlock, { type: 'button' }>), label: c.button })
  if (c.code) blocks.push({ ...(newBlock('code') as Extract<EmailBlock, { type: 'code' }>), label: c.code })
  if (withExpiry) blocks.push({ ...(newBlock('paragraph') as Extract<EmailBlock, { type: 'paragraph' }>), text: CHROME[locale].expiry })
  if (c.extra) blocks.push({ ...(newBlock('paragraph') as Extract<EmailBlock, { type: 'paragraph' }>), text: c.extra })
  blocks.push(
    { ...(newBlock('note') as Extract<EmailBlock, { type: 'note' }>), title: c.noteTitle, text: c.noteText },
    newBlock('divider'),
    { ...(newBlock('footer') as Extract<EmailBlock, { type: 'footer' }>), text: CHROME[locale].footer },
  )
  return { subject: c.subject, preheader: c.preheader, blocks }
}

const COPY: Record<string, { en: Copy; ar: Copy; expiry: boolean }> = {
  confirm_signup: {
    expiry: true,
    en: { subject: 'Confirm your Buddget account', preheader: 'Your Buddget code is {{code}}. It expires in {{expires_in}}.', title: 'Confirm your email', intro: 'Enter this code in Buddget to verify your email and finish setting up your account.', code: 'Verification code', noteTitle: 'Didn’t ask for this?', noteText: 'You can ignore this email. Someone may have typed your address by mistake, and nothing happens without the code.' },
    ar: { subject: 'أكّد حسابك في Buddget', preheader: 'رمزك في Buddget هو {{code}}. تنتهي صلاحيته خلال {{expires_in}}.', title: 'أكّد بريدك الإلكتروني', intro: 'أدخل هذا الرمز في Buddget للتحقق من بريدك الإلكتروني وإكمال إعداد حسابك.', code: 'رمز التحقق', noteTitle: 'لم تطلب هذا؟', noteText: 'يمكنك تجاهل هذه الرسالة. ربما كتب أحدهم عنوانك بالخطأ، ولن يحدث شيء بدون الرمز.' },
  },
  sign_in_code: {
    expiry: true,
    en: { subject: 'Your Buddget sign-in code', preheader: 'Your Buddget code is {{code}}. It expires in {{expires_in}}.', title: 'Sign in to Buddget', intro: 'Enter this code to sign in, or tap the button.', button: 'Sign in', code: 'Sign-in code', noteTitle: 'Didn’t try to sign in?', noteText: 'You can ignore this email. Nobody can get in without the code or this link.' },
    ar: { subject: 'رمز تسجيل الدخول إلى Buddget', preheader: 'رمزك في Buddget هو {{code}}. تنتهي صلاحيته خلال {{expires_in}}.', title: 'سجّل الدخول إلى Buddget', intro: 'أدخل هذا الرمز لتسجيل الدخول، أو اضغط على الزر.', button: 'تسجيل الدخول', code: 'رمز الدخول', noteTitle: 'لم تحاول تسجيل الدخول؟', noteText: 'يمكنك تجاهل هذه الرسالة. لا يمكن لأحد الدخول بدون الرمز أو هذا الرابط.' },
  },
  password_reset: {
    expiry: true,
    en: { subject: 'Reset your Buddget password', preheader: 'Choose a new password for your Buddget account.', title: 'Reset your password', intro: 'Tap the button to choose a new password, or use the code below.', button: 'Reset password', code: 'Reset code', noteTitle: 'Didn’t ask for this?', noteText: 'Your password stays the same until you use this link. You can ignore this email.' },
    ar: { subject: 'إعادة تعيين كلمة مرور Buddget', preheader: 'اختر كلمة مرور جديدة لحسابك في Buddget.', title: 'أعد تعيين كلمة المرور', intro: 'اضغط على الزر لاختيار كلمة مرور جديدة، أو استخدم الرمز أدناه.', button: 'إعادة تعيين كلمة المرور', code: 'رمز إعادة التعيين', noteTitle: 'لم تطلب هذا؟', noteText: 'تبقى كلمة مرورك كما هي حتى تستخدم هذا الرابط. يمكنك تجاهل هذه الرسالة.' },
  },
  email_change: {
    expiry: true,
    en: { subject: 'Confirm your new Buddget email', preheader: 'Confirm the new email address for your account.', title: 'Confirm your new email', intro: 'Tap the button to make this the email address for your Buddget account, or use the code below.', button: 'Confirm email', code: 'Confirmation code', noteTitle: 'Didn’t ask for this?', noteText: 'Your email stays the same until you confirm. If this wasn’t you, change your password.' },
    ar: { subject: 'أكّد بريدك الجديد في Buddget', preheader: 'أكّد عنوان البريد الإلكتروني الجديد لحسابك.', title: 'أكّد بريدك الإلكتروني الجديد', intro: 'اضغط على الزر لجعل هذا العنوان بريد حسابك في Buddget، أو استخدم الرمز أدناه.', button: 'تأكيد البريد', code: 'رمز التأكيد', noteTitle: 'لم تطلب هذا؟', noteText: 'يبقى بريدك كما هو حتى تؤكد. إذا لم تكن أنت، غيّر كلمة المرور.' },
  },
  reauthentication: {
    expiry: true,
    en: { subject: 'Confirm it’s you', preheader: 'Your Buddget code is {{code}}.', title: 'Confirm it’s you', intro: 'Enter this code to continue with the sensitive change you asked for.', code: 'Confirmation code', noteTitle: 'Didn’t ask for this?', noteText: 'Someone may be using your account. Change your password right away.' },
    ar: { subject: 'تأكيد هويتك', preheader: 'رمزك في Buddget هو {{code}}.', title: 'تأكد أنها أنت', intro: 'أدخل هذا الرمز لمتابعة التغيير الحساس الذي طلبته.', code: 'رمز التأكيد', noteTitle: 'لم تطلب هذا؟', noteText: 'ربما يستخدم أحدهم حسابك. غيّر كلمة المرور فورًا.' },
  },
  invite_admin: {
    expiry: false,
    en: { subject: 'You’re invited to the Buddget admin portal', preheader: 'You’ve been invited to the Buddget admin portal. Accept to set up your account.', eyebrow: 'Admin portal', title: 'You’re invited to the Buddget admin portal', intro: 'You’ve been given staff access. Accept the invitation to sign in and finish setting up your admin account.', button: 'Accept invitation', extra: 'Button not working? Paste this link into your browser:\n{{link}}', noteTitle: 'Weren’t expecting this?', noteText: 'Ignore this email and no access is granted. This link is personal to you, so please don’t forward it.' },
    ar: { subject: 'دعوة للانضمام إلى لوحة إدارة Buddget', preheader: 'تمت دعوتك إلى لوحة إدارة Buddget. اقبل الدعوة لإعداد حسابك.', eyebrow: 'لوحة الإدارة', title: 'دعوة للانضمام إلى لوحة إدارة Buddget', intro: 'مُنحت صلاحية الفريق. اقبل الدعوة لتسجيل الدخول وإكمال إعداد حساب الإدارة.', button: 'قبول الدعوة', extra: 'الزر لا يعمل؟ الصق هذا الرابط في المتصفح:\n{{link}}', noteTitle: 'لم تكن تتوقع هذا؟', noteText: 'تجاهل هذه الرسالة ولن يُمنح أي وصول. هذا الرابط شخصي لك، لذا يُرجى عدم تمريره.' },
  },
  admin_unlock_code: {
    expiry: true,
    en: { subject: 'Your Buddget admin portal code', preheader: 'Your admin portal code is {{code}}.', eyebrow: 'Admin portal', title: 'Your admin code', intro: 'Enter this code to continue in the admin portal.', code: 'Admin code', noteTitle: 'Didn’t ask for this?', noteText: 'Someone may know your password. Change it and tell the team.' },
    ar: { subject: 'رمز لوحة إدارة Buddget', preheader: 'رمز لوحة الإدارة هو {{code}}.', eyebrow: 'لوحة الإدارة', title: 'رمز الإدارة', intro: 'أدخل هذا الرمز للمتابعة في لوحة الإدارة.', code: 'رمز الإدارة', noteTitle: 'لم تطلب هذا؟', noteText: 'ربما يعرف أحدهم كلمة مرورك. غيّرها وأبلغ الفريق.' },
  },
  welcome: {
    expiry: false,
    en: { subject: 'Welcome to Buddget', preheader: 'Your account is ready.', title: 'Welcome to Buddget', intro: 'Hi {{first_name}}, your account is ready. Track what you spend, plan your month and stay on top of your goals.', noteTitle: 'Need a hand?', noteText: 'Reply to {{support_email}} and we’ll help.' },
    ar: { subject: 'أهلًا بك في Buddget', preheader: 'حسابك جاهز.', title: 'أهلًا بك في Buddget', intro: 'مرحبًا {{first_name}}، حسابك جاهز. تابع مصروفاتك وخطط لشهرك وحقق أهدافك.', noteTitle: 'تحتاج مساعدة؟', noteText: 'راسلنا على {{support_email}} وسنساعدك.' },
  },
}

/** The templates compiled into the app. Used to seed the database and whenever a stored template is missing or fails to render. */
export function builtinTemplate(key: string, locale: EmailLocale): TemplateContent | null {
  const c = COPY[key]
  return c ? build(locale, c[locale], c.expiry) : null
}

/** A starting point for a new custom scenario. */
export function blankTemplate(locale: EmailLocale): TemplateContent {
  return build(locale, { subject: locale === 'ar' ? 'رسالة من Buddget' : 'A message from Buddget', preheader: '', title: locale === 'ar' ? 'عنوان' : 'Heading', intro: locale === 'ar' ? 'اكتب رسالتك هنا.' : 'Write your message here.', noteTitle: '', noteText: '' }, false)
}

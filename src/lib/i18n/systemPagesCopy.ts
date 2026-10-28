export interface SystemPagesCopy {
  routeError: { title: string; retry: string; report: (id: string) => string }
  rootError: { title: string; body: string; retry: string; report: (id: string) => string }
  offline: { title: string; body: string; retry: string }
  iosSmsSetup: {
    tokenMissing: string
    bearerToken: string
    hide: string
    reveal: string
    copied: string
    copy: string
    tokenWarning: string
    parseEndpoint: string
    ingestEndpoint: string
  }
}

export const systemPagesCopyEn: SystemPagesCopy = {
  routeError: { title: 'Something went wrong', retry: 'Try again', report: (id) => `Report ${id}` },
  rootError: {
    title: 'Buddget hit a problem',
    body: 'Your data is safe. Try again, and if it keeps happening, quote the report number to support.',
    retry: 'Try again',
    report: (id) => `Report ${id}`,
  },
  offline: {
    title: 'You’re offline',
    body: 'Check your connection and try again.',
    retry: 'Try again',
  },
  iosSmsSetup: {
    tokenMissing: 'We couldn’t generate a setup token for your account. Reload the page or check your network connection.',
    bearerToken: 'Your bearer token',
    hide: 'Hide',
    reveal: 'Reveal',
    copied: 'Copied',
    copy: 'Copy',
    tokenWarning: 'Treat this like a password. Anyone with it can post SMS to your account.',
    parseEndpoint: 'AI parse endpoint',
    ingestEndpoint: 'Regex ingest endpoint',
  },
}

export const systemPagesCopyAr: SystemPagesCopy = {
  routeError: { title: 'حدث خطأ ما', retry: 'حاول مرة أخرى', report: (id) => `البلاغ ${id}` },
  rootError: {
    title: 'واجه Buddget مشكلة',
    body: 'بياناتك بأمان. حاول مرة أخرى، وإذا تكرر الأمر فاذكر رقم البلاغ للدعم.',
    retry: 'حاول مرة أخرى',
    report: (id) => `البلاغ ${id}`,
  },
  offline: {
    title: 'أنت غير متصل',
    body: 'تحقق من اتصالك وحاول مرة أخرى.',
    retry: 'حاول مرة أخرى',
  },
  iosSmsSetup: {
    tokenMissing: 'تعذّر إنشاء رمز الإعداد لحسابك. أعد تحميل الصفحة أو تحقق من اتصالك بالشبكة.',
    bearerToken: 'رمز الوصول الخاص بك',
    hide: 'إخفاء',
    reveal: 'إظهار',
    copied: 'تم النسخ',
    copy: 'نسخ',
    tokenWarning: 'تعامل معه كما تتعامل مع كلمة المرور. أي شخص يملكه يمكنه إرسال رسائل SMS إلى حسابك.',
    parseEndpoint: 'عنوان التحليل بالذكاء الاصطناعي',
    ingestEndpoint: 'عنوان الاستقبال بالتعبيرات النمطية',
  },
}

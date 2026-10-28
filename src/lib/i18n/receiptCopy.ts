export interface ReceiptScanCopy {
  errors: {
    unavailable: string
    unreadable: string
    limitReached: string
    signInRequired: string
    offline: string
    networkLost: string
    scanFailed: (status: number) => string
    scanFallback: string
    scannerFallback: string
    storedImageUnreadable: string
  }
  openingCamera: string
  openingCameraHint: string
  reading: string
  readingHint: string
  captured: string
  capturedOffline: string
  done: string
  notReceiptTitle: string
  notReceiptBody: string
  scanAgain: string
  chooseGallery: string
  tryAgainTitle: string
  tryAgain: string
  idlePrompt: string
  scan: string
  gallery: string
  reviewTitle: string
  previewAlt: string
  receiptAlt: string
  amount: string
  currency: string
  merchant: string
  merchantPlaceholder: string
  category: string
  date: string
  saveExpense: string
  rescan: string
  breakdown: string
  unassigned: (amount: string) => string
  mismatch: (sum: string, total: string) => string
}

export const receiptScanCopyEn: ReceiptScanCopy = {
  errors: {
    unavailable: 'AI scanning is temporarily offline. Set up the expense manually or try again in a moment.',
    unreadable: 'We had trouble reading this receipt. Make sure the total and merchant are clearly visible, then try again.',
    limitReached: 'Receipt scanning limit reached. Try again in a moment.',
    signInRequired: 'Sign in to use receipt scanning.',
    offline: 'You’re offline. Receipt scanning needs an internet connection. Try again once you’re back online.',
    networkLost: 'Network connection lost. Check your internet and try again.',
    scanFailed: (status) => `Scan failed (${status}). Try again.`,
    scanFallback: 'Couldn’t scan that receipt. Try again.',
    scannerFallback: 'Couldn’t open the scanner. Try again.',
    storedImageUnreadable: 'Couldn’t read the stored receipt image.',
  },
  openingCamera: 'Opening camera…',
  openingCameraHint: 'Line up your receipt and capture it.',
  reading: 'Reading your receipt…',
  readingHint: 'Pulling out the merchant, total, and items.',
  captured: 'Receipt captured',
  capturedOffline:
    'You’re offline right now, so we saved the photo on your device. When you’re back online, a chip will appear at the top of the app. Tap it to finish adding this receipt.',
  done: 'Done',
  notReceiptTitle: 'That doesn’t look like a receipt',
  notReceiptBody: 'We couldn’t find a total or merchant. Point the camera at a printed receipt, or pick a clearer photo.',
  scanAgain: 'Scan again',
  chooseGallery: 'Choose from gallery',
  tryAgainTitle: 'Let’s try that again',
  tryAgain: 'Try again',
  idlePrompt: 'Scan a receipt to add it as an expense.',
  scan: 'Scan',
  gallery: 'Gallery',
  reviewTitle: 'Review & save',
  previewAlt: 'Receipt preview',
  receiptAlt: 'Receipt',
  amount: 'Amount',
  currency: 'Currency',
  merchant: 'Merchant',
  merchantPlaceholder: 'Where you spent',
  category: 'Category',
  date: 'Date',
  saveExpense: 'Save expense',
  rescan: 'Rescan',
  breakdown: 'Breakdown',
  unassigned: (amount) => `${amount} unassigned. It will be saved under the unread items so the breakdown matches the total.`,
  mismatch: (sum, total) => `Breakdown sums to ${sum} but the total reads ${total}. The total is what gets saved.`,
}

export const receiptScanCopyAr: ReceiptScanCopy = {
  errors: {
    unavailable: 'المسح بالذكاء الاصطناعي متوقف مؤقتاً. أدخل المصروف يدوياً أو حاول بعد قليل.',
    unreadable: 'واجهنا صعوبة في قراءة هذا الإيصال. تأكد من وضوح الإجمالي واسم المتجر ثم حاول مرة أخرى.',
    limitReached: 'تم الوصول إلى حد مسح الإيصالات. حاول بعد قليل.',
    signInRequired: 'سجّل الدخول لاستخدام مسح الإيصالات.',
    offline: 'أنت غير متصل. مسح الإيصالات يحتاج إلى اتصال بالإنترنت. حاول مرة أخرى عند عودة الاتصال.',
    networkLost: 'انقطع الاتصال بالشبكة. تحقق من الإنترنت وحاول مرة أخرى.',
    scanFailed: (status) => `فشل المسح (${status}). حاول مرة أخرى.`,
    scanFallback: 'تعذّر مسح هذا الإيصال. حاول مرة أخرى.',
    scannerFallback: 'تعذّر فتح الماسح. حاول مرة أخرى.',
    storedImageUnreadable: 'تعذّرت قراءة صورة الإيصال المحفوظة.',
  },
  openingCamera: 'جارٍ فتح الكاميرا…',
  openingCameraHint: 'وجّه الكاميرا نحو الإيصال والتقطه.',
  reading: 'جارٍ قراءة الإيصال…',
  readingHint: 'نستخرج اسم المتجر والإجمالي والبنود.',
  captured: 'تم التقاط الإيصال',
  capturedOffline:
    'أنت غير متصل الآن، لذلك حفظنا الصورة على جهازك. عند عودة الاتصال ستظهر شارة أعلى التطبيق. اضغط عليها لإكمال إضافة هذا الإيصال.',
  done: 'تم',
  notReceiptTitle: 'لا يبدو هذا إيصالاً',
  notReceiptBody: 'لم نجد إجمالياً أو اسم متجر. وجّه الكاميرا نحو إيصال مطبوع أو اختر صورة أوضح.',
  scanAgain: 'مسح مرة أخرى',
  chooseGallery: 'اختيار من المعرض',
  tryAgainTitle: 'لنحاول مرة أخرى',
  tryAgain: 'حاول مرة أخرى',
  idlePrompt: 'امسح إيصالاً لإضافته كمصروف.',
  scan: 'مسح',
  gallery: 'المعرض',
  reviewTitle: 'راجع واحفظ',
  previewAlt: 'معاينة الإيصال',
  receiptAlt: 'الإيصال',
  amount: 'المبلغ',
  currency: 'العملة',
  merchant: 'المتجر',
  merchantPlaceholder: 'أين أنفقت',
  category: 'الفئة',
  date: 'التاريخ',
  saveExpense: 'حفظ المصروف',
  rescan: 'إعادة المسح',
  breakdown: 'التفاصيل',
  unassigned: (amount) => `${amount} غير موزّع. سيُحفظ ضمن البنود غير المقروءة لتطابق التفاصيل الإجمالي.`,
  mismatch: (sum, total) => `مجموع التفاصيل ${sum} لكن الإجمالي ${total}. الإجمالي هو ما سيُحفظ.`,
}

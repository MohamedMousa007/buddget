import { arCount } from '@/lib/i18n/arPlural'

export interface VoiceCopy {
  listening: string
  holdMic: string
  releaseHint: string
  tryExamples: string
  micRequired: string
  cancel: string
  micNeededTitle: string
  micNeededBody: string
  allowMic: string
  transcribing: string
  transcribingShort: string
  openInChat: string
  askAgain: string
  close: string
  detailPrompt: string
  answerByVoice: string
  recordingSaved: string
  offlineBody: string
  offlineBodyShort: string
  done: string
  couldntCapture: string
  somethingWrong: string
  errorFallback: string
  tryAgain: string
  releaseToCancel: string
  releaseToSave: string
  stages: { record: string; transcribe: string; extract: string; validate: string; apply: string }
  errors: {
    stepFormat: (stage: string, message: string) => string
    micDenied: string
    micFallback: string
    offline: string
    transcribeSlow: string
    extractSlow: string
    noCatch: string
    serverUnreachable: string
    assistantNoReply: string
    transcriptionFailed: (status: number) => string
    tooLarge: string
    saveFallback: string
  }
  recap: {
    nothingToSave: string
    transactionsCount: (n: number) => string
    confirmToSave: string
    saveAll: string
    save: string
    redo: string
    amount: string
    currency: string
    category: string
    paymentMethod: string
    actionLabels: {
      add_expense: string
      add_income: string
      add_debt: string
      add_debt_payment: string
      deposit_savings: string
      withdraw_savings: string
      add_savings_account: string
      add_payment_method: string
    }
    fieldLabels: {
      source: string
      debtName: string
      person: string
      account: string
      accountName: string
      name: string
      description: string
    }
  }
}

export const voiceCopyEn: VoiceCopy = {
  listening: 'Listening… speak your expense.',
  holdMic: 'Hold mic to record',
  releaseHint: 'Release to transcribe · Drag to trash to cancel',
  tryExamples: 'Try "200 جنيه taxi", "90 EGP Talabat", or "120 dirhams Carrefour".',
  micRequired: ' (Microphone access required.)',
  cancel: 'Cancel',
  micNeededTitle: 'Microphone access needed',
  micNeededBody: 'Allow microphone access so Buddget can hear your expense.',
  allowMic: 'Allow Microphone',
  transcribing: 'Transcribing your voice…',
  transcribingShort: 'Transcribing…',
  openInChat: 'Open in chat',
  askAgain: 'Ask again',
  close: 'Close',
  detailPrompt: 'Could you add a bit more detail?',
  answerByVoice: 'Answer by voice',
  recordingSaved: 'Recording saved',
  offlineBody:
    'You’re offline right now, so we kept it on your device. When you’re back online, a chip will appear at the top of the app. Tap it to finish adding this expense.',
  offlineBodyShort:
    'Recording saved. You’re offline. Tap the chip at the top when you’re back online to finish it.',
  done: 'Done',
  couldntCapture: 'Couldn’t capture that',
  somethingWrong: 'Something went wrong',
  errorFallback: 'Something went wrong. Try again or close.',
  tryAgain: 'Try again',
  releaseToCancel: 'Release to cancel',
  releaseToSave: 'Release to save · drag up to cancel',
  stages: { record: 'Recording', transcribe: 'Transcription', extract: 'Understanding', validate: 'Checking', apply: 'Saving' },
  errors: {
    stepFormat: (stage, message) => `${stage} step: ${message}`,
    micDenied: 'Microphone access denied. Enable it in your device Settings.',
    micFallback: 'Couldn\u2019t access the microphone. Try again.',
    offline: 'You\u2019re offline. Voice needs an internet connection. Try again once you\u2019re back online.',
    transcribeSlow: 'Transcription took too long. Try again.',
    extractSlow: 'The assistant took too long. Try again.',
    noCatch: 'Didn\u2019t catch that. Try again in a quieter spot.',
    serverUnreachable: 'couldn\u2019t reach the server',
    assistantNoReply: 'the assistant didn\u2019t respond',
    transcriptionFailed: (status) => `transcription failed (${status})`,
    tooLarge: 'That recording is too long. Keep it under about 3 minutes.',
    saveFallback: 'Couldn\u2019t save. Try again.',
  },
  recap: {
    nothingToSave: 'Nothing to save',
    transactionsCount: (n) => `${n} transactions`,
    confirmToSave: 'Confirm to save',
    saveAll: 'Save all',
    save: 'Save',
    redo: 'Redo',
    amount: 'Amount',
    currency: 'Currency',
    category: 'Category',
    paymentMethod: 'Payment method',
    actionLabels: {
      add_expense: 'Expense',
      add_income: 'Income',
      add_debt: 'Debt',
      add_debt_payment: 'Debt payment',
      deposit_savings: 'Savings deposit',
      withdraw_savings: 'Savings withdrawal',
      add_savings_account: 'Savings account',
      add_payment_method: 'Payment method',
    },
    fieldLabels: {
      source: 'Source',
      debtName: 'Debt name',
      person: 'Person',
      account: 'Account',
      accountName: 'Account name',
      name: 'Name',
      description: 'Description',
    },
  },
}

export const voiceCopyAr: VoiceCopy = {
  listening: 'جارٍ الاستماع… قل مصروفك.',
  holdMic: 'اضغط مطولاً على الميكروفون للتسجيل',
  releaseHint: 'ارفع إصبعك للتفريغ · اسحب إلى سلة المهملات للإلغاء',
  tryExamples: 'جرّب: "200 جنيه تاكسي" أو "90 EGP Talabat" أو "120 درهم Carrefour".',
  micRequired: ' (يلزم السماح بالوصول إلى الميكروفون.)',
  cancel: 'إلغاء',
  micNeededTitle: 'نحتاج إلى الوصول إلى الميكروفون',
  micNeededBody: 'اسمح بالوصول إلى الميكروفون ليتمكن Buddget من سماع مصروفك.',
  allowMic: 'السماح بالميكروفون',
  transcribing: 'جارٍ تفريغ صوتك…',
  transcribingShort: 'جارٍ التفريغ…',
  openInChat: 'فتح في المحادثة',
  askAgain: 'اسأل مرة أخرى',
  close: 'إغلاق',
  detailPrompt: 'هل يمكنك إضافة تفاصيل أكثر؟',
  answerByVoice: 'أجب بالصوت',
  recordingSaved: 'تم حفظ التسجيل',
  offlineBody:
    'أنت غير متصل الآن، لذلك حفظناه على جهازك. عند عودة الاتصال ستظهر شارة أعلى التطبيق. اضغط عليها لإكمال إضافة هذا المصروف.',
  offlineBodyShort:
    'تم حفظ التسجيل. أنت غير متصل. اضغط على الشارة في الأعلى عند عودة الاتصال لإكماله.',
  done: 'تم',
  couldntCapture: 'تعذّر التقاط ذلك',
  somethingWrong: 'حدث خطأ ما',
  errorFallback: 'حدث خطأ ما. حاول مرة أخرى أو أغلق.',
  tryAgain: 'حاول مرة أخرى',
  releaseToCancel: 'ارفع إصبعك للإلغاء',
  releaseToSave: 'ارفع إصبعك للحفظ · اسحب للأعلى للإلغاء',
  stages: { record: 'التسجيل', transcribe: 'التفريغ', extract: 'الفهم', validate: 'التحقق', apply: 'الحفظ' },
  errors: {
    stepFormat: (stage, message) => `خطوة ${stage}: ${message}`,
    micDenied: 'تم رفض الوصول إلى الميكروفون. فعّله من إعدادات جهازك.',
    micFallback: 'تعذّر الوصول إلى الميكروفون. حاول مرة أخرى.',
    offline: 'أنت غير متصل. الأوامر الصوتية تحتاج إلى اتصال بالإنترنت. حاول مرة أخرى عند عودة الاتصال.',
    transcribeSlow: 'استغرق التفريغ وقتاً طويلاً. حاول مرة أخرى.',
    extractSlow: 'استغرق المساعد وقتاً طويلاً. حاول مرة أخرى.',
    noCatch: 'لم نسمع ذلك جيداً. حاول مرة أخرى في مكان أهدأ.',
    serverUnreachable: 'تعذّر الوصول إلى الخادم',
    assistantNoReply: 'لم يستجب المساعد',
    transcriptionFailed: (status) => `فشل التفريغ (${status})`,
    tooLarge: 'التسجيل طويل جدًا. اجعله أقل من 3 دقائق تقريبًا.',
    saveFallback: 'تعذّر الحفظ. حاول مرة أخرى.',
  },
  recap: {
    nothingToSave: 'لا شيء للحفظ',
    transactionsCount: (n) => arCount(n, 'transaction'),
    confirmToSave: 'أكّد للحفظ',
    saveAll: 'حفظ الكل',
    save: 'حفظ',
    redo: 'إعادة',
    amount: 'المبلغ',
    currency: 'العملة',
    category: 'الفئة',
    paymentMethod: 'طريقة الدفع',
    actionLabels: {
      add_expense: 'مصروف',
      add_income: 'دخل',
      add_debt: 'دين',
      add_debt_payment: 'دفعة دين',
      deposit_savings: 'إيداع في المدخرات',
      withdraw_savings: 'سحب من المدخرات',
      add_savings_account: 'حساب مدخرات',
      add_payment_method: 'طريقة دفع',
    },
    fieldLabels: {
      source: 'المصدر',
      debtName: 'اسم الدين',
      person: 'الشخص',
      account: 'الحساب',
      accountName: 'اسم الحساب',
      name: 'الاسم',
      description: 'الوصف',
    },
  },
}

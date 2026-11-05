import { useLocale } from '@/lib/i18n'

export interface AuthSecurityCopy {
  currentPasswordLabel: string
  currentPasswordPlaceholder: string
  otherDevicesNote: string
  errorCurrentPasswordMissing: string
  errorWrongPassword: string
  errorReauthRequired: string
  errorTooManyAttempts: string
  errorChangeFailed: string
  secondStepUnavailable: string
  twoFaOffTitle: string
  twoFaOffBody: string
  twoFaOffConfirm: string
  twoFaOffCancel: string
  twoFaOffNeedsSignIn: string
  twoFaChangeFailed: string
  biometricEnrolTitle: string
  biometricEnrolBody: string
  biometricEnrolConfirm: string
  biometricEnrolNeedsSignIn: string
  biometricEnrolFailed: string
  gateIntro: string
  gateFailed: string
  gateNotNow: string
  gateSignOut: string
}

const en: AuthSecurityCopy = {
  currentPasswordLabel: 'Current password',
  currentPasswordPlaceholder: 'Your current password',
  otherDevicesNote: 'Your other devices will be signed out and biometric sign-in will need to be set up again.',
  errorCurrentPasswordMissing: 'Enter your current password.',
  errorWrongPassword: 'That is not your current password.',
  errorReauthRequired: 'Sign in again to change your password.',
  errorTooManyAttempts: 'Too many attempts. Try again in a few minutes.',
  errorChangeFailed: 'Couldn\u2019t change your password. Try again.',
  secondStepUnavailable: 'We could not check your second step. Check your connection and try again.',
  twoFaOffTitle: 'Turn off two-factor authentication?',
  twoFaOffBody: 'Enter your password to confirm it is you. Anyone with your password will be able to sign in without an email code.',
  twoFaOffConfirm: 'Turn off',
  twoFaOffCancel: 'Keep it on',
  twoFaOffNeedsSignIn: 'Sign out and sign in again, then turn it off.',
  twoFaChangeFailed: 'Couldn\u2019t change two-factor authentication. Try again.',
  biometricEnrolTitle: 'Confirm it is you',
  biometricEnrolBody: 'Enter your password to turn on biometric sign-in. It lets this phone sign in to your account without a password.',
  biometricEnrolConfirm: 'Turn on',
  biometricEnrolNeedsSignIn: 'Sign out and sign in again, then turn on biometric sign-in.',
  biometricEnrolFailed: 'Couldn\u2019t turn on biometric sign-in. Try again.',
  gateIntro: 'For your security, confirm it is you with the code we email you. Your data is safe and will sync right after.',
  gateFailed: 'We couldn\u2019t confirm that code. Your data is safe on this device. Try again, or sign out.',
  gateNotNow: 'Not now',
  gateSignOut: 'Sign out',
}

const ar: AuthSecurityCopy = {
  currentPasswordLabel: 'كلمة المرور الحالية',
  currentPasswordPlaceholder: 'كلمة المرور الحالية',
  otherDevicesNote: 'سيتم تسجيل خروجك من أجهزتك الأخرى، وستحتاج إلى إعداد الدخول بالبصمة من جديد.',
  errorCurrentPasswordMissing: 'أدخل كلمة المرور الحالية.',
  errorWrongPassword: 'هذه ليست كلمة المرور الحالية.',
  errorReauthRequired: 'سجّل الدخول مرة أخرى لتغيير كلمة المرور.',
  errorTooManyAttempts: 'محاولات كثيرة. حاول بعد دقائق.',
  errorChangeFailed: 'تعذّر تغيير كلمة المرور. حاول مرة أخرى.',
  secondStepUnavailable: 'تعذّر التحقق من الخطوة الثانية. تحقق من الاتصال وحاول مرة أخرى.',
  twoFaOffTitle: 'إيقاف المصادقة الثنائية؟',
  twoFaOffBody: 'أدخل كلمة المرور للتأكد أنك أنت. أي شخص يعرف كلمة المرور سيتمكن من الدخول دون رمز البريد.',
  twoFaOffConfirm: 'إيقاف',
  twoFaOffCancel: 'إبقاؤها مفعّلة',
  twoFaOffNeedsSignIn: 'سجّل الخروج ثم الدخول من جديد، ثم أوقفها.',
  twoFaChangeFailed: 'تعذّر تغيير المصادقة الثنائية. حاول مرة أخرى.',
  biometricEnrolTitle: 'أكّد أنك أنت',
  biometricEnrolBody: 'أدخل كلمة المرور لتفعيل الدخول بالبصمة. يتيح لهذا الهاتف الدخول إلى حسابك دون كلمة مرور.',
  biometricEnrolConfirm: 'تفعيل',
  biometricEnrolNeedsSignIn: 'سجّل الخروج ثم الدخول من جديد، ثم فعّل الدخول بالبصمة.',
  biometricEnrolFailed: 'تعذّر تفعيل الدخول بالبصمة. حاول مرة أخرى.',
  gateIntro: 'لحمايتك، أكّد أنك أنت بالرمز الذي أرسلناه إلى بريدك. بياناتك بأمان وستتم مزامنتها فور التأكيد.',
  gateFailed: 'تعذّر تأكيد الرمز. بياناتك بأمان على هذا الجهاز. حاول مرة أخرى أو سجّل الخروج.',
  gateNotNow: 'ليس الآن',
  gateSignOut: 'تسجيل الخروج',
}

export function useAuthSecurityCopy(): AuthSecurityCopy {
  return useLocale().locale === 'ar' ? ar : en
}

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
}

const en: AuthSecurityCopy = {
  currentPasswordLabel: 'Current password',
  currentPasswordPlaceholder: 'Your current password',
  otherDevicesNote: 'Your other devices will be signed out and biometric sign-in will need to be set up again.',
  errorCurrentPasswordMissing: 'Enter your current password.',
  errorWrongPassword: 'That is not your current password.',
  errorReauthRequired: 'Sign in again to change your password.',
  errorTooManyAttempts: 'Too many attempts. Try again in a few minutes.',
  errorChangeFailed: 'Could not change your password. Try again.',
  secondStepUnavailable: 'We could not check your second step. Check your connection and try again.',
  twoFaOffTitle: 'Turn off two-factor authentication?',
  twoFaOffBody: 'Enter your password to confirm it is you. Anyone with your password will be able to sign in without an email code.',
  twoFaOffConfirm: 'Turn off',
  twoFaOffCancel: 'Keep it on',
  twoFaOffNeedsSignIn: 'Sign out and sign in again, then turn it off.',
  twoFaChangeFailed: 'Could not change two-factor authentication. Try again.',
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
}

export function useAuthSecurityCopy(): AuthSecurityCopy {
  return useLocale().locale === 'ar' ? ar : en
}

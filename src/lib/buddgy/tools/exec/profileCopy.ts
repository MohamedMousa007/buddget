import type { BuddgyLocale } from '@/lib/buddgy/protocol'

const EN = {
  title: 'Update profile',
  name: 'Name',
  country: 'Country',
  city: 'City',
  household: 'Household',
  lifestyleTier: 'Lifestyle',
  foodFrequency: 'Eating out',
  transportMode: 'Main transport',
  monthlyRent: 'Monthly rent',
  rentIncludesUtilities: 'Rent includes utilities',
  yes: 'Yes',
  no: 'No',
  none: '—',
  household_: { solo: 'Just me', couple: 'Couple', family: 'Family' },
  lifestyleTier_: { minimal: 'Minimal, save hard', balanced: 'Balanced', comfortable: 'Comfortable, enjoy more' },
  foodFrequency_: { everyday: 'Almost every day', mostdays: 'Most days', sometimes: 'A few times a week', rarely: 'Rarely' },
  transportMode_: { public: 'Public transit', car: 'My own car', taxi: 'Ride-hailing / taxis', walk: 'Walk / cycle' },
}

type Labels = typeof EN

const AR: Labels = {
  title: 'تعديل الملف الشخصي',
  name: 'الاسم',
  country: 'البلد',
  city: 'المدينة',
  household: 'الأسرة',
  lifestyleTier: 'نمط الحياة',
  foodFrequency: 'الأكل خارج المنزل',
  transportMode: 'وسيلة التنقل الرئيسية',
  monthlyRent: 'الإيجار الشهري',
  rentIncludesUtilities: 'الإيجار يشمل المرافق',
  yes: 'نعم',
  no: 'لا',
  none: '—',
  household_: { solo: 'أنا فقط', couple: 'زوجان', family: 'عائلة' },
  lifestyleTier_: { minimal: 'مقتصدة، ادخار قوي', balanced: 'متوازنة', comfortable: 'مريحة، استمتع أكثر' },
  foodFrequency_: { everyday: 'تقريباً كل يوم', mostdays: 'معظم الأيام', sometimes: 'بضع مرات أسبوعياً', rarely: 'نادراً' },
  transportMode_: { public: 'النقل العام', car: 'سيارتي الخاصة', taxi: 'تاكسي / تطبيقات النقل', walk: 'مشي / دراجة' },
}

export const profileLabels = (locale: BuddgyLocale): Labels => (locale === 'ar' ? AR : EN)

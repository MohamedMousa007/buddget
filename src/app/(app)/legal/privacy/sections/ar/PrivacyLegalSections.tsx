import { LegalSection } from '@/components/legal/LegalSection'
import { ExternalLink, Strong, SupportMail } from '@/components/legal/LegalInline'

/** Arabic of sections 11–13: International Transfers, Changes to Policy, Contact. */
export function PrivacyLegalSectionsAr() {
  return (
    <>
      <LegalSection title="11. نقل البيانات دوليًا">
        <p>
          قد تُعالَج بياناتك في بلدان غير بلدك، بما في ذلك الولايات المتحدة التي تستضيف بنية Supabase وGoogle وGroq
          التحتية. وقد تختلف قوانين حماية البيانات في هذه البلدان عن مثيلاتها في مصر أو الإمارات أو بلد إقامتك.
        </p>
        <p>باستخدامك الخدمة، فإنك تقرّ بعمليات النقل هذه وتوافق عليها بقدر ما هو ضروري لتقديم الخدمة.</p>
      </LegalSection>

      <LegalSection title="12. التغييرات على هذه السياسة">
        <p>
          قد نحدّث سياسة الخصوصية هذه لتعكس التغييرات في ممارساتنا أو ميزاتنا أو المتطلبات القانونية. وبالنسبة للتغييرات
          الجوهرية سنقوم بما يلي:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>نشر إشعار واضح داخل التطبيق</li>
          <li>إرسال رسالة إلى بريدك الإلكتروني المسجَّل في حسابك</li>
          <li>تحديث تاريخ «آخر تحديث» في أعلى هذه الصفحة</li>
        </ul>
        <p>
          يُعدّ استمرارك في الاستخدام بعد تاريخ السريان قبولًا. وإذا لم توافق، فتوقف عن استخدام الخدمة واحذف حسابك.
        </p>
      </LegalSection>

      <LegalSection title="13. تواصل معنا">
        <p>لجميع استفسارات الخصوصية وطلبات ممارسة الحقوق وحذف البيانات:</p>
        <p>
          <Strong>البريد الإلكتروني:</Strong> <SupportMail />
        </p>
        <p>
          <Strong>الموقع الإلكتروني:</Strong> <ExternalLink href="https://buddget.app">buddget.app</ExternalLink>
        </p>
        <p className="mt-3 text-xs text-[var(--color-brand-text-muted)]">
          بالنسبة لطلبات CCPA، أدرج عبارة «CCPA Request» في سطر الموضوع. وبالنسبة لطلبات GDPR، أدرج عبارة «GDPR Request» في
          سطر الموضوع. سنرد خلال 30 يومًا.
        </p>
        <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">© 2026 بادجت. جميع الحقوق محفوظة.</p>
      </LegalSection>
    </>
  )
}

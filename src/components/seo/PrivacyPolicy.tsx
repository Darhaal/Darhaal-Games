import { PRIVACY_CONTENT, POLICY_UPDATED } from '@/content/privacy';
import type { Locale } from '@/games/registry';
import PublicShell from './PublicShell';
import { breadcrumbJsonLd } from '@/lib/seo';
import JsonLd from './JsonLd';

/**
 * The privacy policy page, shared by the RU route and its /en counterpart.
 *
 * A server component like the rest of the public tree: it must be readable
 * without JavaScript, and it would be a poor look for the page explaining
 * what the site collects to need the site's client bundle to render.
 */
export default function PrivacyPolicy({ locale }: { locale: Locale }) {
  const t = PRIVACY_CONTENT[locale];
  // Built from the parts rather than `new Date(POLICY_UPDATED)`: an ISO date
  // string parses as UTC midnight, which formats as the *previous* day for
  // anyone west of it. The policy would then claim a date it does not have.
  const [year, month, day] = POLICY_UPDATED.split('-').map(Number);
  const updated = new Date(year, month - 1, day).toLocaleDateString(
    locale === 'ru' ? 'ru-RU' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <PublicShell locale={locale}>
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: t.title, path: '/privacy' }
        ])}
      />

      <article className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-gray-900">
          {t.title}
        </h1>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-gray-400">
          {t.updated}: {updated}
        </p>

        <div className="mt-8 space-y-4">
          {t.intro.map((p, i) => (
            <p key={i} className="text-base text-gray-600 leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-12 space-y-10">
          {t.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-gray-900">
                {section.title}
              </h2>
              <div className="mt-4 space-y-3">
                {section.body.map((p, i) => (
                  <p key={i} className="text-sm md:text-base text-gray-600 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-gray-900">
              {t.contactTitle}
            </h2>
            <div className="mt-4 space-y-3">
              {t.contact.map((p, i) => (
                <p key={i} className="text-sm md:text-base text-gray-600 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </section>
        </div>
      </article>
    </PublicShell>
  );
}

import { COMPANY_NAME, companyPage } from '@/constants/app';
import type { Locale } from '@/lib/locale';

/**
 * The footers' "© 2026 Okhten Group LLC". The company name is a plain,
 * followed link to the studio's site in the page's language — a backlink
 * from every page that has a footer.
 */
export default function Copyright({ locale }: { locale: Locale }) {
  return (
    <span>
      © 2026{' '}
      <a href={companyPage(locale)} className="hover:text-accent transition-colors">
        {COMPANY_NAME}
      </a>
    </span>
  );
}

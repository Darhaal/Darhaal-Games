import type { Metadata } from 'next';
import PrivacyPolicy from '@/components/seo/PrivacyPolicy';
import { privacyMetadata } from '@/lib/seo';

export const metadata: Metadata = privacyMetadata('ru');

export default function PrivacyPage() {
  return <PrivacyPolicy locale="ru" />;
}

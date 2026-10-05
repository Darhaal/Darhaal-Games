import type { Metadata } from 'next';
import PrivacyPolicy from '@/components/seo/PrivacyPolicy';
import { privacyMetadata } from '@/lib/seo';

export const metadata: Metadata = privacyMetadata('ru');

export default function PrivacyPageRu() {
  return <PrivacyPolicy locale="ru" />;
}

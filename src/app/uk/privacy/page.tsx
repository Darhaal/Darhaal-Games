import type { Metadata } from 'next';
import PrivacyPolicy from '@/components/seo/PrivacyPolicy';
import { privacyMetadata } from '@/lib/seo';

export const metadata: Metadata = privacyMetadata('uk');

export default function PrivacyPageUk() {
  return <PrivacyPolicy locale="uk" />;
}

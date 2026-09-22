import type { Metadata } from 'next';
import PrivacyPolicy from '@/components/seo/PrivacyPolicy';
import { privacyMetadata } from '@/lib/seo';

export const metadata: Metadata = privacyMetadata('en');

export default function PrivacyPageEn() {
  return <PrivacyPolicy locale="en" />;
}

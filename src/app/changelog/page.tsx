import type { Metadata } from 'next';
import Changelog from '@/components/seo/Changelog';
import { changelogMetadata } from '@/lib/seo';

export const metadata: Metadata = changelogMetadata('en');

export default function ChangelogPage() {
  return <Changelog locale="en" />;
}

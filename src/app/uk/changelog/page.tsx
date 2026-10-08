import type { Metadata } from 'next';
import Changelog from '@/components/seo/Changelog';
import { changelogMetadata } from '@/lib/seo';

export const metadata: Metadata = changelogMetadata('uk');

export default function ChangelogPageUk() {
  return <Changelog locale="uk" />;
}

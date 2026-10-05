import type { Metadata } from 'next';
import Changelog from '@/components/seo/Changelog';
import { changelogMetadata } from '@/lib/seo';

export const metadata: Metadata = changelogMetadata('ru');

export default function ChangelogPageRu() {
  return <Changelog locale="ru" />;
}

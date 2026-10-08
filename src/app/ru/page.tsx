import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';
import HomeLanding from '@/components/seo/HomeLanding';
import { homeMetadata } from '@/lib/seo';

export const metadata: Metadata = homeMetadata('ru');

/** The domain root in Russian — the same app entry as `/`, with the landing in Russian. */
export default function HomeRu() {
  return <HomeClient locale="ru" landing={<HomeLanding locale="ru" />} />;
}

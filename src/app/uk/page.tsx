import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';
import HomeLanding from '@/components/seo/HomeLanding';
import { homeMetadata } from '@/lib/seo';

export const metadata: Metadata = homeMetadata('uk');

/** The domain root in Ukrainian — the same app entry as `/`, with the landing in Ukrainian. */
export default function HomeUk() {
  return <HomeClient locale="uk" landing={<HomeLanding locale="uk" />} />;
}

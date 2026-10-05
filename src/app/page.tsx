import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';
import HomeLanding from '@/components/seo/HomeLanding';
import { homeMetadata } from '@/lib/seo';

export const metadata: Metadata = homeMetadata('en');

/**
 * The domain root.
 *
 * A server component whose only job is to render the landing into the initial
 * HTML and hand it to the client shell. Before this, `/` served an auth wall
 * and nothing else — seven words and no outbound links on the most
 * authoritative URL of the site.
 *
 * The client decides what to actually show: the app for a signed-in player,
 * the sign-in card plus this content for everyone else.
 */
export default function Home() {
  return <HomeClient landing={<HomeLanding locale="en" />} />;
}

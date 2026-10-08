import type { Metadata } from 'next';
import GamesHub from '@/components/seo/GamesHub';
import { hubMetadata } from '@/lib/seo';

export const metadata: Metadata = hubMetadata('uk');

export default function GamesHubPageUk() {
  return <GamesHub locale="uk" />;
}

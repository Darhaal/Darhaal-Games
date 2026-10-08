import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GameDetail from '@/components/seo/GameDetail';
import { GAME_SLUGS, getGameContent } from '@/content/games';
import { gameMetadata } from '@/lib/seo';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GAME_SLUGS.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameContent(slug);
  if (!game) return {};
  return gameMetadata(game, 'uk');
}

export default async function GamePageUk({ params }: Params) {
  const { slug } = await params;
  const game = getGameContent(slug);
  if (!game) notFound();

  return <GameDetail game={game} locale="uk" />;
}

import { GAME_SLUGS, getGameContent } from '@/content/games';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Darhaal Games';

export function generateStaticParams() {
  return GAME_SLUGS.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGameContent(slug);
  const copy = game?.locales.ru;

  return renderOgImage({
    title: copy?.name ?? 'Darhaal Games',
    subtitle: copy?.tagline ?? '',
    accent: game?.accent
  });
}

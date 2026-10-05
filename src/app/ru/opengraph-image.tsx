import { APP_TAGLINE } from '@/constants/app';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Darhaal Games';

/** The card a link to a Russian page unfurls into in a chat. */
export default function Image() {
  return renderOgImage({
    title: 'Darhaal Games',
    subtitle: APP_TAGLINE.ru
  });
}

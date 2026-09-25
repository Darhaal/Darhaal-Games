'use client';

import Avatar from 'boring-avatars';
import { LOCATION_PACK } from '@/data/spyfall/locations';
import { locationIcon } from './locationIcon';

/**
 * Artwork for a location card, generated rather than downloaded.
 *
 * `public/spyfall/` never existed, so every location image path had been
 * returning 404 since the packs were written — the UI hid the broken image and
 * fell back to a flat grey gradient, which is why it went unnoticed. Rather
 * than sourcing and hosting 330 photographs, each card draws its own: a
 * deterministic `boring-avatars` field seeded by the location id, plus a
 * thematic lucide icon.
 *
 * Nothing is fetched. Both libraries render inline SVG from the bundle, so a
 * card costs zero requests and zero hosting bandwidth, works offline, and is
 * stable — a location always looks the same to everyone.
 *
 * It reads as artwork rather than a placeholder because the card already
 * covers this layer with a scrim and centres the location name over it: at
 * 200×125 a photograph would be texture anyway. The icon sits low and faint
 * so it never competes with that label.
 */

/** Muted enough to sit under a dark scrim without fighting the white label. */
const PALETTE = ['#1A1F26', '#9e1316', '#2F3E4E', '#6B7A8F', '#C9A227'];

export default function LocationArt({
  locationId,
  className = ''
}: {
  locationId: string;
  className?: string;
}) {
  const Icon = locationIcon(locationId, LOCATION_PACK[locationId] ?? '');

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {/* The art is square and the cards are wide: a square as wide as the
          card, centred, covers it and the overflow is cropped. Fitting it to
          the box instead letterboxed it, with grey bands down both sides. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full aspect-square [&>svg]:w-full [&>svg]:h-full">
        <Avatar name={locationId} variant="marble" colors={PALETTE} square size={100} />
      </div>

      {/* eslint-disable-next-line react-hooks/static-components -- locationIcon is a lookup, not a factory: it returns one of a fixed set of module-level lucide components, so this reference is stable across renders and never remounts */}
      <Icon
        className="absolute -bottom-2 -right-2 w-[55%] h-[55%] text-white/25"
        strokeWidth={1.25}
      />
    </div>
  );
}

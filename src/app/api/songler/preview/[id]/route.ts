/**
 * A song's 30-second preview for Songler — docs/songler-spec.md, section 7.
 *
 * Deezer signs its preview links and they expire in about fifteen minutes, so
 * the pool stores the track id and this route looks the link up when a round
 * needs it, then redirects. The audio itself goes straight from Deezer's CDN
 * to the player, which allows cross-origin reads, so the page can decode it
 * and play exactly half a second.
 *
 * Deezer's API sends no CORS headers, which is why the browser does not ask
 * it directly.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,15}$/.test(id)) return new Response('Bad track id', { status: 400 });

  let preview: unknown;
  try {
    const res = await fetch(`https://api.deezer.com/track/${id}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    preview = (await res.json())?.preview;
  } catch {
    return new Response('Deezer did not answer', { status: 502 });
  }
  if (typeof preview !== 'string' || !preview.startsWith('https://')) {
    return new Response('No preview for this track', { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: preview,
      // Shorter than the link lives, so a cached redirect never points at an expired one.
      'Cache-Control': 'private, max-age=300'
    }
  });
}

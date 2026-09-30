// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractParagraphs, fetchArticle, otherVersions, pickRandomArticle, resolveTitle, WIKI_HEADERS, WikipediaError
} from '@/lib/wikiler/wikipedia';

/**
 * Talking to Wikipedia. The HTML below is small but shaped like the real
 * thing — Wikipedia's article API (Parsoid) — as checked against the live
 * "Apple" article on 2026-09-29; the network is mocked.
 */

const PARSOID = `<!DOCTYPE html>
<html about="//en.wikipedia.org/wiki/Special:Redirect/revision/1376890199"><head><title>Apple</title></head>
<body>
<section data-mw-section-id="0">
  <div role="note" class="hatnote navigation-not-searchable">For the company, see Apple Inc.</div>
  <table class="infobox"><tr><td>Kingdom: Plantae</td></tr></table>
  <p>An <b>apple</b> is the round, edible fruit of an apple tree.<sup class="mw-ref reference"><a>[1]</a></sup></p>
  <figure><figcaption>Apple blossom</figcaption></figure>
  <p>Apples have been grown for thousands of years.</p>
</section>
<section data-mw-section-id="1"><h2 id="Etymology">Etymology</h2>
  <p>The word derives from Old English.</p>
  <ul><li>First sense<ul><li>nested detail</li></ul></li><li>Second sense</li></ul>
</section>
<section data-mw-section-id="2"><h2 id="See_also">See also</h2>
  <ul><li>Pear</li></ul>
  <section><h3>Related</h3><p>Should be skipped with its parent section.</p></section>
</section>
<section data-mw-section-id="3"><h2 id="In_culture">In culture</h2>
  <p>The apple appears in myths.</p>
</section>
<section data-mw-section-id="4"><h2 id="References">References</h2><p>Cited works.</p></section>
</body></html>`;

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('extractParagraphs', () => {
  const paragraphs = extractParagraphs(parse(PARSOID), 'en');
  const texts = paragraphs.map((p) => p.text);

  it('keeps headings and prose, in order', () => {
    expect(paragraphs).toEqual([
      { text: 'An apple is the round, edible fruit of an apple tree.' },
      { text: 'Apples have been grown for thousands of years.' },
      { text: 'Etymology', heading: true },
      { text: 'The word derives from Old English.' },
      { text: 'First sense nested detail' },
      { text: 'Second sense' },
      { text: 'In culture', heading: true },
      { text: 'The apple appears in myths.' }
    ]);
  });

  it('drops the hatnote, which would name the article outright', () => {
    expect(texts.join(' ')).not.toContain('For the company');
  });

  it('drops footnote marks, infoboxes and captions', () => {
    expect(texts.join(' ')).not.toMatch(/\[1\]|Kingdom|blossom/);
  });

  it('drops sections of sources and links, with their subsections', () => {
    expect(texts.join(' ')).not.toMatch(/Pear|Related|Should be skipped|Cited works|See also|References/);
  });

  it('skips Russian reference sections by their Russian headings', () => {
    const ru = extractParagraphs(parse(
      '<body><p>Текст статьи.</p><h2>Примечания</h2><p>Сноска.</p><h2>Литература</h2><p>Книга.</p></body>'
    ), 'ru');
    expect(ru).toEqual([{ text: 'Текст статьи.' }]);
  });
});

describe('the network', () => {
  afterEach(() => vi.unstubAllGlobals());

  const answer = (body: string | object, status = 200) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

  it('fetches a named revision and reads its number and title', async () => {
    const fetchMock = vi.fn(async () => answer(PARSOID));
    vi.stubGlobal('fetch', fetchMock);

    const article = await fetchArticle('en', 'Apple', 1376890199);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://en.wikipedia.org/api/rest_v1/page/html/Apple/1376890199',
      { headers: WIKI_HEADERS }
    );
    expect(article).toMatchObject({ title: 'Apple', revision: 1376890199 });
    expect(article.paragraphs[0].text).toContain('edible fruit');
  });

  it('identifies itself to Wikimedia on every request', () => {
    expect(WIKI_HEADERS['Api-User-Agent']).toMatch(/^DarhaalGames-Wikiler\/\S+ \(https:\/\/games\.okhten\.com\)$/);
  });

  it('reports a refusal as an error, not as an empty article', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer('You are making too many requests to the API.', 429)));

    await expect(fetchArticle('en', 'Apple')).rejects.toBeInstanceOf(WikipediaError);
  });

  it('follows redirects to name the article a typed title leads to', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer({
      query: { redirects: [{ from: 'Исаак Ньютон', to: 'Ньютон, Исаак' }], pages: [{ title: 'Ньютон, Исаак' }] }
    })));

    expect(await resolveTitle('ru', 'Исаак Ньютон')).toBe('Ньютон, Исаак');
  });

  it('a title that leads nowhere resolves to nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer({ query: { pages: [{ title: 'Qwertyuiop', missing: true }] } })));

    expect(await resolveTitle('en', 'Qwertyuiop')).toBeNull();
    expect(await resolveTitle('en', '   ')).toBeNull();
  });

  describe('a random article', () => {
    const long = Array.from({ length: 520 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i / 26) % 26))}`).join(' ');
    const playable = `<html about="//en.wikipedia.org/wiki/Special:Redirect/revision/42"><head><title>Long One</title></head><body><p>${long}</p></body></html>`;
    const batch = (pages: object[]) => answer({ query: { pages } });

    it('skips the short and the unread, and returns the first playable one', async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('generator=random')) {
          return batch([
            { title: 'Stub', length: 900, pageviews: { a: 5000 } },
            { title: 'Nobody Reads', length: 40_000, pageviews: { a: 10, b: null } },
            { title: 'Long One', length: 30_000, pageviews: { a: 400 } }
          ]);
        }
        return answer(playable);
      });
      vi.stubGlobal('fetch', fetchMock);

      expect(await pickRandomArticle('en')).toMatchObject({ title: 'Long One', revision: 42 });
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('page/html'))).toHaveLength(1);
    });

    it('gives up after three batches so the pool can take over', async () => {
      const fetchMock = vi.fn(async () => batch([{ title: 'Stub', length: 900, pageviews: { a: 5 } }]));
      vi.stubGlobal('fetch', fetchMock);

      expect(await pickRandomArticle('en')).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('never repeats an article already played in the match', async () => {
      vi.stubGlobal('fetch', vi.fn(async (url: string) =>
        url.includes('generator=random')
          ? batch([{ title: 'Long One', length: 30_000, pageviews: { a: 400 } }])
          : answer(playable)
      ));

      expect(await pickRandomArticle('en', new Set(['Long One']))).toBeNull();
    });

    it('when players read Russian too, takes one that is playable in Russian as well', async () => {
      const russian = playable.replace('en.wikipedia.org', 'ru.wikipedia.org').replace('revision/42', 'revision/77').replace('Long One', 'Длинная');
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('generator=random')) {
          return batch([
            { title: 'No Russian', length: 50_000, pageviews: { a: 900 } },
            { title: 'Long One', length: 30_000, pageviews: { a: 400 } }
          ]);
        }
        if (url.includes('prop=langlinks')) {
          return answer({ query: { pages: [{ langlinks: url.includes('Long%20One') ? [{ lang: 'de', title: 'Lang' }, { lang: 'ru', title: 'Длинная' }] : [] }] } });
        }
        return answer(url.startsWith('https://ru.') ? russian : playable);
      });
      vi.stubGlobal('fetch', fetchMock);

      expect(await pickRandomArticle('en', new Set(), ['ru'])).toEqual({
        title: 'Long One', revision: 42, versions: { ru: { title: 'Длинная', revision: 77 } }
      });
    });
  });

  describe('the other versions of an article', () => {
    const long = Array.from({ length: 520 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i / 26) % 26))}`).join(' ');
    const playable = `<html about="//en.wikipedia.org/wiki/Special:Redirect/revision/42"><head><title>Long One</title></head><body><p>${long}</p></body></html>`;

    it('uses titles it already knows without asking for the links', async () => {
      const fetchMock = vi.fn(async () => answer(playable));
      vi.stubGlobal('fetch', fetchMock);

      expect(await otherVersions('ru', 'Длинная', ['en'], { en: 'Long One' })).toEqual({ en: { title: 'Long One', revision: 42 } });
      // One request, the English article itself: no interlanguage links looked up.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refuses an article whose other version is too short', async () => {
      const short = '<html about="//en.wikipedia.org/wiki/Special:Redirect/revision/5"><head><title>Short</title></head><body><p>Too few words.</p></body></html>';
      vi.stubGlobal('fetch', vi.fn(async () => answer(short)));

      expect(await otherVersions('ru', 'Короткая', ['en'], { en: 'Short' })).toBeNull();
    });

    it('needs nothing when everyone reads one language', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      expect(await otherVersions('ru', 'Любая', [])).toEqual({});
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

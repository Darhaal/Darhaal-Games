import { SPYFALL_PACKS } from '@/data/spyfall/locations';
import type { Locale } from '@/content/games';
import { pluralEn, pluralRu } from '@/lib/plural';

/**
 * Every Spyfall location, by pack, on the game's public page — a server
 * component, so it is HTML and nothing else.
 *
 * Search Console showed Russian Spyfall queries bringing nearly all of the
 * site's impressions, and "spyfall locations" is something people search for
 * on its own. The list is the game's own data, so it never drifts from what a
 * room actually deals.
 */

const T = {
  ru: {
    title: 'Все локации «Шпиона»',
    lead: (locations: number, packs: number) =>
      `${locations} ${pluralRu(locations, ['локация', 'локации', 'локаций'])} в ${packs} ${pluralRu(packs, ['наборе', 'наборах', 'наборах'])}. Хост выбирает набор при создании комнаты; у каждой локации — двадцать ролей, чтобы у игроков было о чём рассказать.`
  },
  en: {
    title: 'Every Spyfall location',
    lead: (locations: number, packs: number) =>
      `${locations} ${pluralEn(locations, 'location', 'locations')} in ${packs} ${pluralEn(packs, 'pack', 'packs')}. The host picks a pack when creating the room; each location comes with twenty roles, so everyone has something to talk about.`
  }
};

export default function SpyfallLocations({ locale }: { locale: Locale }) {
  const t = T[locale];
  const total = SPYFALL_PACKS.reduce((n, p) => n + p.locations.length, 0);

  return (
    <section className="mt-12">
      <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900">{t.title}</h2>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{t.lead(total, SPYFALL_PACKS.length)}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {SPYFALL_PACKS.map((pack) => (
          <div key={pack.id} className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-base font-black tracking-tight text-gray-900">
              <span aria-hidden className="mr-1.5">{pack.emoji}</span>
              {pack.name[locale]}
              <span className="ml-2 text-2xs font-bold text-gray-400 tabular-nums">{pack.locations.length}</span>
            </h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              {pack.locations.map((l) => l.name[locale]).join(' · ')}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

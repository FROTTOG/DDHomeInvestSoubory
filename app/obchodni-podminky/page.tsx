import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Obchodní podmínky | D&D HOMEINVEST s.r.o.',
  description: 'Obchodní podmínky společnosti D&D HOMEINVEST s.r.o.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function ObchodniPodminkyPage() {
  return (
    <div className="min-h-screen bg-off-white">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl font-bold text-navy mb-4">Obchodní podmínky</h1>
          <p className="font-body text-gray text-lg">D&D HOMEINVEST s.r.o.</p>
        </div>

        <div className="legal-prose max-w-none">
          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">1. Úvodní ustanovení</h2>
            <p>
              Tyto obchodní podmínky upravují vzájemná práva a povinnosti mezi společností D&D HOMEINVEST s.r.o., se sídlem
              Mažice 61, Jižní Čechy, IČO: 29483638 (dále jen &quot;Prodávající&quot;) a zákazníkem (dále jen
              &quot;Kupující&quot;) při prodeji nemovitostí.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">2. Předmět smlouvy</h2>
            <p>Předmětem smlouvy je prodej bytových jednotek a nebytových prostorů v majetku Prodávajícího.</p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">3. Cena a platba</h2>
            <p>
              Cena nemovitosti je stanovena v kupní smlouvě. Platba se uskutečňuje podle dohody stran, zpravidla formou
              zálohy a následné platby zbývající částky.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">4. Práva a povinnosti stran</h2>
            <p>
              Prodávající se zavazuje předat Kupujícímu nemovitost v dohodnutém stavu a termínu. Kupující se zavazuje zaplatit
              sjednanou cenu v dohodnutých lhůtách.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">5. Odstoupení od smlouvy</h2>
            <p>
              Odstoupení od smlouvy je možné pouze za podmínek stanovených v kupní smlouvě a v souladu s platnými právními
              předpisy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">6. Závěrečná ustanovení</h2>
            <p>
              Tyto obchodní podmínky nabývají účinnosti dnem jejich zveřejnění. Veškeré spory vzniklé z obchodních vztahů
              mezi Prodávajícím a Kupujícím budou řešeny dohodou, případně příslušnými soudy České republiky.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-light/60">
          <Link href="/" className="inline-flex items-center gap-2 text-navy hover:text-brass transition-colors">
            ← Zpět na hlavní stránku
          </Link>
        </div>
      </main>
    </div>
  );
}

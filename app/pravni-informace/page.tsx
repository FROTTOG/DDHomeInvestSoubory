import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Právní informace a GDPR | D&D HOMEINVEST s.r.o.',
  description: 'Právní informace a zásady ochrany osobních údajů společnosti D&D HOMEINVEST s.r.o.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function PravniInformacePage() {
  return (
    <div className="min-h-screen bg-off-white">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl font-bold text-navy mb-4">Právní informace a GDPR</h1>
          <p className="font-body text-gray text-lg">D&D HOMEINVEST s.r.o.</p>
        </div>

        <div className="legal-prose max-w-none">
          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">1. Ochrana osobních údajů</h2>
            <p>
              Společnost D&D HOMEINVEST s.r.o. dbá na ochranu vašich osobních údajů. Veškeré údaje, které nám poskytnete,
              zpracováváme v souladu s platnými právními předpisy, zejména s Obecným nařízením o ochraně osobních údajů (GDPR).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">2. Účel zpracování</h2>
            <p>
              Osobní údaje zpracováváme výhradně pro účely komunikace s vámi, poskytnutí požadovaných informací a plnění
              našich smluvních závazků.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">3. Doba uchování</h2>
            <p>
              Vaše osobní údaje uchováváme po dobu nezbytně nutnou pro plnění účelu zpracování, případně po dobu stanovenou
              právními předpisy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">4. Práva subjektu údajů</h2>
            <p>
              Máte právo na přístup k vašim osobním údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost údajů a
              právo vznést námitku proti zpracování. Tyto práva můžete uplatnit kontaktováním naší společnosti.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-navy mb-4">5. Kontaktní údaje</h2>
            <p>
              Pro jakékoliv dotazy týkající se ochrany osobních údajů nás můžete kontaktovat na e-mailové adrese:
              info@ddhomeinvest.cz nebo telefonním čísle: +420 725 591 623.
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

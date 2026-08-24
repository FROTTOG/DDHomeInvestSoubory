'use client';

import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-brass mb-4">404</h1>
          <h2 className="text-2xl font-bold text-white mb-2">Stránka nebyla nalezena</h2>
          <p className="text-white/60">Omlouváme se, ale stránka, kterou hledáte, neexistuje.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-brass text-navy px-6 py-3 rounded-full font-semibold hover:bg-brass-light transition-colors"
          >
            ← Zpět na hlavní stránku
          </Link>
          <Link
            href="/#kontakt"
            className="inline-flex items-center justify-center gap-2 border border-white/20 text-white/80 px-6 py-3 rounded-full hover:border-brass hover:text-brass transition-colors"
          >
            Kontaktujte nás
          </Link>
        </div>
      </div>
    </div>
  );
}
